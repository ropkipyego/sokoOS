import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { TenantsService } from "../tenants/tenants.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

export type CreateReturnItemInput = {
  productId: string;
  quantity: number;
  unitPriceMinor?: number;
};

export type CreateReturnInput = {
  id?: string;
  saleId: string;
  branchId?: string;
  warehouseId?: string;
  reason?: string;
  occurredAt?: string;
  items: CreateReturnItemInput[];
};

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly tenants: TenantsService,
  ) {}

  async list(
    tenantId: string,
    opts: {
      branchId?: string;
      saleId?: string;
      limit?: number;
      cursor?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);

    const rows = await this.prisma.return.findMany({
      where: {
        tenantId,
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(opts.saleId ? { saleId: opts.saleId } : {}),
        ...(opts.from || opts.to
          ? {
              occurredAt: {
                ...(opts.from ? { gte: new Date(opts.from) } : {}),
                ...(opts.to ? { lte: new Date(opts.to) } : {}),
              },
            }
          : {}),
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
      meta: paginateMeta(
        hasMore,
        limit,
        last ? encodeCursor({ id: last.id }) : null,
      ),
    };
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.return.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!row) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Return not found" });
    }
    return row;
  }

  /**
   * Create a return against a sale with compensating stock movements
   * (`type=return`, positive quantityDelta). Supports partial lines (REQ-RET-001/002).
   */
  async create(tenantId: string, userId: string, input: CreateReturnInput) {
    if (!input.items?.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Return requires at least one item",
      });
    }

    if (input.id) {
      const existing = await this.prisma.return.findFirst({
        where: { id: input.id, tenantId },
        include: { items: true },
      });
      if (existing) return existing;
    }

    const sale = await this.prisma.sale.findFirst({
      where: { id: input.saleId, tenantId },
      include: { items: true },
    });
    if (!sale) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });
    }
    if (sale.status === "voided") {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Cannot return items from a voided sale",
      });
    }

    const branchId = input.branchId ?? sale.branchId;
    if (branchId !== sale.branchId) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Return branch must match the original sale branch",
      });
    }

    const priorReturns = await this.prisma.return.findMany({
      where: { tenantId, saleId: sale.id, status: { not: "cancelled" } },
      include: { items: true },
    });
    const alreadyReturned = new Map<string, number>();
    for (const ret of priorReturns) {
      for (const item of ret.items) {
        alreadyReturned.set(
          item.productId,
          (alreadyReturned.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }

    const saleQtyByProduct = new Map<string, { quantity: number; unitPriceMinor: number }>();
    for (const line of sale.items) {
      const cur = saleQtyByProduct.get(line.productId);
      if (cur) {
        cur.quantity += line.quantity;
      } else {
        saleQtyByProduct.set(line.productId, {
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
        });
      }
    }

    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        id: { in: input.items.map((i) => i.productId) },
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lineItems = input.items.map((item) => {
      if (item.quantity < 1) {
        throw new UnprocessableEntityException({
          code: "VALIDATION_FAILED",
          message: "Return item quantity must be >= 1",
        });
      }
      const sold = saleQtyByProduct.get(item.productId);
      if (!sold) {
        throw new UnprocessableEntityException({
          code: "VALIDATION_FAILED",
          message: `Product ${item.productId} was not on the original sale`,
        });
      }
      const remaining = sold.quantity - (alreadyReturned.get(item.productId) ?? 0);
      if (item.quantity > remaining) {
        throw new UnprocessableEntityException({
          code: "VALIDATION_FAILED",
          message: `Return quantity for ${item.productId} exceeds remaining returnable qty (${remaining})`,
        });
      }
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: `Product ${item.productId} not found`,
        });
      }
      const unitPriceMinor = item.unitPriceMinor ?? sold.unitPriceMinor;
      return {
        product,
        quantity: item.quantity,
        unitPriceMinor,
        lineTotalMinor: unitPriceMinor * item.quantity,
      };
    });

    // Aggregate duplicate product lines in one request
    const aggregated = new Map<string, (typeof lineItems)[number]>();
    for (const line of lineItems) {
      const existing = aggregated.get(line.product.id);
      if (existing) {
        existing.quantity += line.quantity;
        existing.lineTotalMinor += line.lineTotalMinor;
        const sold = saleQtyByProduct.get(line.product.id)!;
        const remaining = sold.quantity - (alreadyReturned.get(line.product.id) ?? 0);
        if (existing.quantity > remaining) {
          throw new UnprocessableEntityException({
            code: "VALIDATION_FAILED",
            message: `Return quantity for ${line.product.id} exceeds remaining returnable qty (${remaining})`,
          });
        }
      } else {
        aggregated.set(line.product.id, { ...line });
      }
    }
    const finalLines = [...aggregated.values()];
    const totalMinor = finalLines.reduce((s, l) => s + l.lineTotalMinor, 0);

    const warehouse = input.warehouseId
      ? await this.prisma.warehouse.findFirst({
          where: { id: input.warehouseId, tenantId },
        })
      : await this.resolveWarehouseForSale(tenantId, sale.id, branchId);

    if (!warehouse) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Warehouse not found for return restock",
      });
    }

    const tenant = await this.tenants.getCurrent(tenantId);
    const policy = this.tenants.getNegativeStockPolicy(tenant);

    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          id: input.id ?? randomUUID(),
          tenantId,
          branchId,
          saleId: sale.id,
          status: "completed",
          totalMinor,
          reason: input.reason ?? null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          createdBy: userId,
          items: {
            create: finalLines.map((l) => ({
              tenantId,
              productId: l.product.id,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
              lineTotalMinor: l.lineTotalMinor,
            })),
          },
        },
        include: { items: true },
      });

      for (const line of finalLines) {
        if (!line.product.trackInventory) continue;
        await this.inventory.applyMovementInTx(
          tx,
          tenantId,
          {
            warehouseId: warehouse.id,
            productId: line.product.id,
            type: "return",
            quantityDelta: line.quantity,
            branchId,
            referenceType: "return",
            referenceId: ret.id,
            reason: input.reason ?? "Sale return",
          },
          userId,
          policy,
        );
      }

      return ret;
    });
  }

  /** Prefer warehouse used by original sale movements; else branch default. */
  private async resolveWarehouseForSale(
    tenantId: string,
    saleId: string,
    branchId: string,
  ) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: {
        tenantId,
        referenceType: "sale",
        referenceId: saleId,
      },
      orderBy: { createdAt: "asc" },
    });
    if (movement) {
      return this.prisma.warehouse.findFirst({
        where: { id: movement.warehouseId, tenantId },
      });
    }
    return this.inventory.getDefaultWarehouse(tenantId, branchId);
  }
}
