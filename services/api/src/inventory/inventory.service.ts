import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Prisma } from "@sokoos/database";
import { PrismaService } from "../prisma/prisma.service";
import { TenantsService } from "../tenants/tenants.service";
import {
  applyMovementToBalance,
  type NegativeStockPolicy,
} from "./stock-balance.math";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";
import { randomUUID } from "node:crypto";

export type CreateMovementInput = {
  id?: string;
  warehouseId: string;
  productId: string;
  type: string;
  quantityDelta: number;
  unitCostMinor?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  correlationId?: string | null;
  reason?: string | null;
  deviceId?: string | null;
  branchId: string;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  async listWarehouses(tenantId: string, branchId?: string) {
    return this.prisma.warehouse.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async createWarehouse(
    tenantId: string,
    input: { branchId: string; name: string; isDefault?: boolean },
    userId?: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Branch not found" });
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.warehouse.updateMany({
          where: { tenantId, branchId: input.branchId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.warehouse.create({
        data: {
          tenantId,
          branchId: input.branchId,
          name: input.name,
          isDefault: input.isDefault ?? false,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    });
  }

  async listBalances(
    tenantId: string,
    opts: {
      warehouseId?: string;
      productId?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{
      warehouseId: string;
      productId: string;
    }>(opts.cursor);

    const rows = await this.prisma.stockBalance.findMany({
      where: {
        tenantId,
        ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
        ...(opts.productId ? { productId: opts.productId } : {}),
        ...(cursor
          ? {
              OR: [
                { warehouseId: { gt: cursor.warehouseId } },
                {
                  warehouseId: cursor.warehouseId,
                  productId: { gt: cursor.productId },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ warehouseId: "asc" }, { productId: "asc" }],
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
        last
          ? encodeCursor({
              warehouseId: last.warehouseId,
              productId: last.productId,
            })
          : null,
      ),
    };
  }

  async listMovements(
    tenantId: string,
    opts: {
      warehouseId?: string;
      productId?: string;
      type?: string;
      from?: string;
      to?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);

    const rows = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
        ...(opts.productId ? { productId: opts.productId } : {}),
        ...(opts.type ? { type: opts.type } : {}),
        ...(opts.from || opts.to
          ? {
              createdAt: {
                ...(opts.from ? { gte: new Date(opts.from) } : {}),
                ...(opts.to ? { lte: new Date(opts.to) } : {}),
              },
            }
          : {}),
        ...(cursor ? { id: { gt: cursor.id } } : {}),
      },
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

  /**
   * Append a stock movement and update the balance projection in one transaction.
   * Never overwrites stock arbitrarily.
   */
  async createMovement(
    tenantId: string,
    input: CreateMovementInput,
    userId?: string,
    policy?: NegativeStockPolicy,
  ) {
    if (input.id) {
      const dup = await this.prisma.stockMovement.findUnique({
        where: { id: input.id },
      });
      if (dup) {
        // Idempotent: duplicate movement UUID is a no-op
        return dup;
      }
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId },
    });
    if (!warehouse) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Warehouse not found",
      });
    }

    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Product not found",
      });
    }

    let negativePolicy = policy;
    if (!negativePolicy) {
      const tenant = await this.tenants.getCurrent(tenantId);
      negativePolicy = this.tenants.getNegativeStockPolicy(tenant);
    }

    return this.prisma.$transaction(async (tx) => {
      return this.applyMovementInTx(tx, tenantId, input, userId, negativePolicy!);
    });
  }

  /**
   * Apply movement + balance update inside an existing transaction.
   */
  async applyMovementInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: CreateMovementInput,
    userId: string | undefined,
    policy: NegativeStockPolicy,
  ) {
    const balance = await tx.stockBalance.findUnique({
      where: {
        tenantId_warehouseId_productId: {
          tenantId,
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    });

    const currentQty = balance?.quantity ?? 0;
    const result = applyMovementToBalance(
      currentQty,
      input.quantityDelta,
      policy,
    );

    if (!result.ok) {
      throw new UnprocessableEntityException({
        code: "NEGATIVE_STOCK_BLOCKED",
        message: "Movement would make stock negative",
        details: [
          {
            path: "quantityDelta",
            message: `Balance would become ${result.nextQuantity}`,
            code: "NEGATIVE_STOCK_BLOCKED",
          },
        ],
      });
    }

    const movement = await tx.stockMovement.create({
      data: {
        id: input.id ?? randomUUID(),
        tenantId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        type: input.type,
        quantityDelta: input.quantityDelta,
        unitCostMinor: input.unitCostMinor ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        correlationId: input.correlationId ?? null,
        reason: input.reason ?? null,
        deviceId: input.deviceId ?? null,
        createdBy: userId ?? null,
      },
    });

    await tx.stockBalance.upsert({
      where: {
        tenantId_warehouseId_productId: {
          tenantId,
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
      create: {
        tenantId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        quantity: result.nextQuantity,
      },
      update: {
        quantity: result.nextQuantity,
      },
    });

    return movement;
  }

  async transfer(
    tenantId: string,
    input: {
      fromWarehouseId: string;
      toWarehouseId: string;
      productId: string;
      quantity: number;
      branchId: string;
      reason?: string;
    },
    userId?: string,
  ) {
    if (input.quantity <= 0) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Transfer quantity must be positive",
      });
    }
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Source and destination warehouses must differ",
      });
    }

    const tenant = await this.tenants.getCurrent(tenantId);
    const policy = this.tenants.getNegativeStockPolicy(tenant);
    const correlationId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const out = await this.applyMovementInTx(
        tx,
        tenantId,
        {
          warehouseId: input.fromWarehouseId,
          productId: input.productId,
          type: "transfer",
          quantityDelta: -input.quantity,
          branchId: input.branchId,
          correlationId,
          reason: input.reason ?? "Transfer out",
        },
        userId,
        policy,
      );
      const inn = await this.applyMovementInTx(
        tx,
        tenantId,
        {
          warehouseId: input.toWarehouseId,
          productId: input.productId,
          type: "transfer",
          quantityDelta: input.quantity,
          branchId: input.branchId,
          correlationId,
          reason: input.reason ?? "Transfer in",
        },
        userId,
        "allow",
      );
      return { out, in: inn, correlationId };
    });
  }

  async getDefaultWarehouse(tenantId: string, branchId: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { tenantId, branchId, isDefault: true, status: "active" },
    });
    if (!wh) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "No default warehouse for branch",
      });
    }
    return wh;
  }
}
