import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { TenantsService } from "../tenants/tenants.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly tenants: TenantsService,
  ) {}

  async list(tenantId: string, opts: { limit?: number; cursor?: string; branchId?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);
    const rows = await this.prisma.purchase.findMany({
      where: {
        tenantId,
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(cursor ? { id: { gt: cursor.id } } : {}),
      },
      include: { items: true, supplier: true, branch: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return {
      data,
      meta: paginateMeta(hasMore, limit, last ? encodeCursor({ id: last.id }) : null),
    };
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.purchase.findFirst({
      where: { id, tenantId },
      include: { items: { include: { product: true } }, supplier: true, branch: true },
    });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "LPO not found" });
    return row;
  }

  async create(
    tenantId: string,
    input: {
      branchId: string;
      supplierId?: string;
      currency?: string;
      reference?: string;
      notes?: string;
      items: Array<{ productId: string; quantity: number; unitCostMinor: number }>;
    },
    userId?: string,
  ) {
    if (!input.items?.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "LPO requires at least one line",
      });
    }
    const tenant = await this.tenants.getCurrent(tenantId);
    const totalMinor = input.items.reduce((s, i) => s + i.quantity * i.unitCostMinor, 0);
    const lpoNumber = await this.nextLpoNumber(tenantId);

    return this.prisma.purchase.create({
      data: {
        tenantId,
        branchId: input.branchId,
        supplierId: input.supplierId,
        status: "draft",
        totalMinor,
        currency: input.currency ?? tenant.currency,
        reference: input.reference,
        notes: input.notes,
        lpoNumber,
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: input.items.map((i) => ({
            tenantId,
            productId: i.productId,
            quantity: i.quantity,
            quantityReceived: 0,
            unitCostMinor: i.unitCostMinor,
            lineTotalMinor: i.quantity * i.unitCostMinor,
          })),
        },
      },
      include: { items: true, supplier: true, branch: true },
    });
  }

  async issue(tenantId: string, id: string, userId?: string) {
    const purchase = await this.get(tenantId, id);
    if (purchase.status !== "draft") {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Only draft LPOs can be issued",
      });
    }
    return this.prisma.purchase.update({
      where: { id },
      data: {
        status: "issued",
        issuedAt: new Date(),
        updatedBy: userId,
        version: { increment: 1 },
      },
      include: { items: true, supplier: true, branch: true },
    });
  }

  async cancel(tenantId: string, id: string, userId?: string) {
    const purchase = await this.get(tenantId, id);
    const received = purchase.items.reduce((s, i) => s + i.quantityReceived, 0);
    if (received > 0) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Cannot cancel an LPO that already has receipts",
      });
    }
    return this.prisma.purchase.update({
      where: { id },
      data: { status: "cancelled", updatedBy: userId, version: { increment: 1 } },
      include: { items: true, supplier: true, branch: true },
    });
  }

  /**
   * Receive stock against the SAME purchase/LPO row.
   * Partial receipts are allowed. Never inserts a second purchase.
   */
  async receive(
    tenantId: string,
    id: string,
    input: {
      warehouseId: string;
      items?: Array<{ productId: string; quantity: number }>;
      receiveId?: string;
    },
    userId?: string,
  ) {
    const purchase = await this.get(tenantId, id);
    if (purchase.status === "cancelled") {
      throw new ConflictException({ code: "CONFLICT", message: "LPO is cancelled" });
    }
    if (purchase.status === "received") {
      throw new ConflictException({
        code: "CONFLICT",
        message: "LPO already fully received",
      });
    }
    if (purchase.status === "draft") {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Issue the LPO before receiving stock",
      });
    }
    if (!purchase.items.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "LPO has no items",
      });
    }

    const receiveId = input.receiveId ?? randomUUID();
    const existingBatch = await this.prisma.stockMovement.findFirst({
      where: { tenantId, correlationId: receiveId, referenceId: purchase.id },
    });
    if (existingBatch) {
      return this.get(tenantId, id);
    }

    const requested =
      input.items?.length
        ? input.items
        : purchase.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity - i.quantityReceived,
          }));

    const lines = requested.filter((i) => i.quantity > 0);
    if (!lines.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Nothing remaining to receive on this LPO",
      });
    }

    const byProduct = new Map(purchase.items.map((i) => [i.productId, i]));
    for (const line of lines) {
      const item = byProduct.get(line.productId);
      if (!item) {
        throw new UnprocessableEntityException({
          code: "VALIDATION_FAILED",
          message: `Product ${line.productId} is not on this LPO`,
        });
      }
      const remaining = item.quantity - item.quantityReceived;
      if (line.quantity < 1 || line.quantity > remaining) {
        throw new UnprocessableEntityException({
          code: "VALIDATION_FAILED",
          message: `Cannot receive ${line.quantity} of ${item.product?.name ?? line.productId}; remaining ${remaining}`,
        });
      }
    }

    const tenant = await this.tenants.getCurrent(tenantId);
    const policy = this.tenants.getNegativeStockPolicy(tenant);

    return this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const item = byProduct.get(line.productId)!;
        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { quantityReceived: item.quantityReceived + line.quantity },
        });
        await this.inventory.applyMovementInTx(
          tx,
          tenantId,
          {
            warehouseId: input.warehouseId,
            productId: line.productId,
            type: "purchase",
            quantityDelta: line.quantity,
            unitCostMinor: item.unitCostMinor,
            branchId: purchase.branchId,
            referenceType: "purchase",
            referenceId: purchase.id,
            correlationId: receiveId,
          },
          userId,
          policy,
        );
      }

      const freshItems = await tx.purchaseItem.findMany({ where: { purchaseId: id } });
      const fullyReceived = freshItems.every((i) => i.quantityReceived >= i.quantity);
      const anyReceived = freshItems.some((i) => i.quantityReceived > 0);

      return tx.purchase.update({
        where: { id },
        data: {
          status: fullyReceived ? "received" : anyReceived ? "partial" : purchase.status,
          receivedAt: fullyReceived ? new Date() : purchase.receivedAt,
          updatedBy: userId,
          version: { increment: 1 },
        },
        include: { items: { include: { product: true } }, supplier: true, branch: true },
      });
    });
  }

  private async nextLpoNumber(tenantId: string) {
    const year = new Date().getUTCFullYear();
    const prefix = `LPO-${year}-`;
    const last = await this.prisma.purchase.findFirst({
      where: { tenantId, lpoNumber: { startsWith: prefix } },
      orderBy: { lpoNumber: "desc" },
      select: { lpoNumber: true },
    });
    const seq = last?.lpoNumber ? Number(last.lpoNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
  }
}
