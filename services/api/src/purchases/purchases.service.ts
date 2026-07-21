import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
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
      include: { items: true },
      orderBy: { id: "asc" },
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
      include: { items: true },
    });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Purchase not found" });
    return row;
  }

  async create(
    tenantId: string,
    input: {
      branchId: string;
      supplierId?: string;
      currency?: string;
      reference?: string;
      items: Array<{ productId: string; quantity: number; unitCostMinor: number }>;
    },
    userId?: string,
  ) {
    const tenant = await this.tenants.getCurrent(tenantId);
    const totalMinor = input.items.reduce(
      (s, i) => s + i.quantity * i.unitCostMinor,
      0,
    );

    return this.prisma.purchase.create({
      data: {
        tenantId,
        branchId: input.branchId,
        supplierId: input.supplierId,
        status: "draft",
        totalMinor,
        currency: input.currency ?? tenant.currency,
        reference: input.reference,
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: input.items.map((i) => ({
            tenantId,
            productId: i.productId,
            quantity: i.quantity,
            unitCostMinor: i.unitCostMinor,
            lineTotalMinor: i.quantity * i.unitCostMinor,
          })),
        },
      },
      include: { items: true },
    });
  }

  async receive(
    tenantId: string,
    id: string,
    input: { warehouseId: string },
    userId?: string,
  ) {
    const purchase = await this.get(tenantId, id);
    if (purchase.status === "received") {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Purchase already received",
      });
    }
    if (!purchase.items.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Purchase has no items",
      });
    }

    const tenant = await this.tenants.getCurrent(tenantId);
    const policy = this.tenants.getNegativeStockPolicy(tenant);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          status: "received",
          receivedAt: new Date(),
          updatedBy: userId,
          version: { increment: 1 },
        },
        include: { items: true },
      });

      for (const item of purchase.items) {
        await this.inventory.applyMovementInTx(
          tx,
          tenantId,
          {
            warehouseId: input.warehouseId,
            productId: item.productId,
            type: "purchase",
            quantityDelta: item.quantity,
            unitCostMinor: item.unitCostMinor,
            branchId: purchase.branchId,
            referenceType: "purchase",
            referenceId: purchase.id,
          },
          userId,
          policy,
        );
      }

      return updated;
    });
  }
}
