import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { TenantsService } from "../tenants/tenants.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

export type CreateSaleItemInput = {
  productId: string;
  quantity: number;
  unitPriceMinor?: number;
  discountMinor?: number;
  taxMinor?: number;
};

export type CreateSalePaymentInput = {
  method: string;
  amountMinor: number;
  reference?: string;
};

export type CreateSaleInput = {
  id?: string;
  branchId: string;
  warehouseId?: string;
  deviceId?: string;
  customerId?: string;
  receiptNumber?: string;
  occurredAt?: string;
  discountMinor?: number;
  currency?: string;
  items: CreateSaleItemInput[];
  payments: CreateSalePaymentInput[];
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly tenants: TenantsService,
  ) {}

  async list(
    tenantId: string,
    opts: {
      branchId?: string;
      limit?: number;
      cursor?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);

    const rows = await this.prisma.sale.findMany({
      where: {
        tenantId,
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
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
      include: { items: true, payments: true },
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
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true, payments: true },
    });
    if (!sale) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });
    }
    return sale;
  }

  /**
   * Create sale + items + payments + stock movements + balance updates
   * in a single transaction.
   */
  async create(tenantId: string, cashierUserId: string, input: CreateSaleInput) {
    if (!input.items?.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Sale requires at least one item",
      });
    }
    if (!input.payments?.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Sale requires at least one payment",
      });
    }

    if (input.id) {
      const existing = await this.prisma.sale.findFirst({
        where: { id: input.id, tenantId },
        include: { items: true, payments: true },
      });
      if (existing) return existing;
    }

    const tenant = await this.tenants.getCurrent(tenantId);
    const policy = this.tenants.getNegativeStockPolicy(tenant);
    const currency = input.currency ?? tenant.currency;

    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Branch not found" });
    }

    const warehouse = input.warehouseId
      ? await this.prisma.warehouse.findFirst({
          where: { id: input.warehouseId, tenantId },
        })
      : await this.inventory.getDefaultWarehouse(tenantId, input.branchId);

    if (!warehouse) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Warehouse not found",
      });
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      if (!productMap.has(item.productId)) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: `Product ${item.productId} not found`,
        });
      }
      if (item.quantity < 1) {
        throw new UnprocessableEntityException({
          code: "VALIDATION_FAILED",
          message: "Item quantity must be >= 1",
        });
      }
    }

    const lineItems = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = item.unitPriceMinor ?? product.priceMinor;
      const discount = item.discountMinor ?? 0;
      const tax = item.taxMinor ?? 0;
      const lineTotal = unitPrice * item.quantity - discount + tax;
      return {
        product,
        quantity: item.quantity,
        unitPriceMinor: unitPrice,
        discountMinor: discount,
        taxMinor: tax,
        lineTotalMinor: lineTotal,
      };
    });

    const subtotalMinor = lineItems.reduce(
      (s, l) => s + l.unitPriceMinor * l.quantity - l.discountMinor,
      0,
    );
    const taxMinor = lineItems.reduce((s, l) => s + l.taxMinor, 0);
    const discountMinor = input.discountMinor ?? 0;
    const totalMinor = subtotalMinor + taxMinor - discountMinor;

    const paymentSum = input.payments.reduce((s, p) => s + p.amountMinor, 0);
    if (paymentSum < totalMinor) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Payments do not cover sale total",
      });
    }

    const receiptNumber =
      input.receiptNumber ??
      `R-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4)}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            id: input.id ?? randomUUID(),
            tenantId,
            branchId: input.branchId,
            deviceId: input.deviceId ?? null,
            cashierUserId,
            customerId: input.customerId ?? null,
            status: "completed",
            subtotalMinor,
            taxMinor,
            discountMinor,
            totalMinor,
            currency,
            receiptNumber,
            occurredAt: input.occurredAt
              ? new Date(input.occurredAt)
              : new Date(),
            createdBy: cashierUserId,
            items: {
              create: lineItems.map((l) => ({
                tenantId,
                productId: l.product.id,
                nameSnapshot: l.product.name,
                skuSnapshot: l.product.sku,
                quantity: l.quantity,
                unitPriceMinor: l.unitPriceMinor,
                discountMinor: l.discountMinor,
                taxMinor: l.taxMinor,
                lineTotalMinor: l.lineTotalMinor,
              })),
            },
            payments: {
              create: input.payments.map((p) => ({
                tenantId,
                method: p.method,
                amountMinor: p.amountMinor,
                reference: p.reference,
              })),
            },
          },
          include: { items: true, payments: true },
        });

        for (const line of lineItems) {
          if (!line.product.trackInventory) continue;
          await this.inventory.applyMovementInTx(
            tx,
            tenantId,
            {
              warehouseId: warehouse.id,
              productId: line.product.id,
              type: "sale",
              quantityDelta: -line.quantity,
              branchId: input.branchId,
              referenceType: "sale",
              referenceId: sale.id,
              deviceId: input.deviceId ?? null,
            },
            cashierUserId,
            policy,
          );
        }

        return sale;
      });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new ConflictException({
          code: "CONFLICT",
          message: "Receipt number already exists",
        });
      }
      throw err;
    }
  }

  async voidSale(tenantId: string, id: string, userId: string) {
    const sale = await this.get(tenantId, id);
    if (sale.status === "voided") return sale;

    return this.prisma.sale.update({
      where: { id },
      data: { status: "voided" },
      include: { items: true, payments: true },
    });
  }
}
