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
import { DiningService } from "../dining/dining.service";
import { EntitlementsService } from "../billing/entitlements.service";
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
  tenderedMinor?: number;
  changeMinor?: number;
  status?: string;
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
  deliveryFeeMinor?: number;
  /** retail | dine_in | takeaway | delivery */
  orderType?: string;
  tableCode?: string;
  departmentId?: string;
  waiterUserId?: string;
  items: CreateSaleItemInput[];
  payments: CreateSalePaymentInput[];
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly tenants: TenantsService,
    private readonly dining: DiningService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(
    tenantId: string,
    opts: {
      branchId?: string;
      departmentId?: string;
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
        ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
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
      include: { items: true, payments: true, cashier: true, customer: true, branch: true, department: true },
      orderBy: { occurredAt: "desc" },
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
      include: { items: true, payments: true, cashier: true, customer: true, branch: true, device: true },
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
    await this.entitlements.assertWrite(tenantId);
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

    const departmentId = await this.resolveDepartmentId(
      tenantId,
      cashierUserId,
      input.branchId,
      input.departmentId,
      input.deviceId,
    );

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

    let customerPriceListId: string | null = null;
    if (input.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, tenantId },
        select: { priceListId: true },
      });
      customerPriceListId = customer?.priceListId ?? null;
    }

    const lineItems = await Promise.all(
      input.items.map(async (item) => {
        const product = productMap.get(item.productId)!;
        let unitPrice = item.unitPriceMinor ?? product.priceMinor;
        if (item.unitPriceMinor == null && customerPriceListId) {
          const tier = await this.prisma.priceListItem.findFirst({
            where: {
              tenantId,
              priceListId: customerPriceListId,
              productId: item.productId,
              minQuantity: { lte: item.quantity },
            },
            orderBy: { minQuantity: "desc" },
          });
          if (tier) unitPrice = tier.priceMinor;
        }
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
      }),
    );

    const subtotalMinor = lineItems.reduce(
      (s, l) => s + l.unitPriceMinor * l.quantity - l.discountMinor,
      0,
    );
    const taxMinor = lineItems.reduce((s, l) => s + l.taxMinor, 0);
    const discountMinor = input.discountMinor ?? 0;
    const deliveryFeeMinor = input.deliveryFeeMinor ?? 0;
    const totalMinor = subtotalMinor + taxMinor - discountMinor + deliveryFeeMinor;

    const completedPayments = input.payments.filter((p) => (p.status ?? "completed") === "completed");
    const paymentSum = completedPayments.reduce((s, p) => s + p.amountMinor, 0);
    const hasPending = input.payments.some((p) => p.status === "pending");
    if (!hasPending && paymentSum < totalMinor) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Payments do not cover sale total",
      });
    }

    const receiptNumber =
      input.receiptNumber ??
      `R-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4)}`;

    const [cashier, device] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: cashierUserId } }),
      input.deviceId
        ? this.prisma.device.findFirst({ where: { id: input.deviceId, tenantId } })
        : Promise.resolve(null),
    ]);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            id: input.id ?? randomUUID(),
            tenantId,
            branchId: input.branchId,
            deviceId: input.deviceId ?? null,
            cashierUserId,
            customerId: input.customerId ?? null,
            status: hasPending && paymentSum < totalMinor ? "pending_payment" : "completed",
            subtotalMinor,
            taxMinor,
            discountMinor,
            totalMinor,
            deliveryFeeMinor,
            currency,
            receiptNumber,
            orderType: input.orderType ?? "retail",
            tableCode: input.tableCode ?? null,
            departmentId,
            waiterUserId: input.waiterUserId ?? null,
            checkStatus:
              input.orderType && input.orderType !== "retail" ? "sent_to_kitchen" : null,
            cashierNameSnapshot: cashier?.name ?? null,
            branchNameSnapshot: branch.name,
            deviceNameSnapshot: device?.name ?? null,
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
                tenderedMinor: p.tenderedMinor,
                changeMinor: p.changeMinor,
                status: p.status ?? "completed",
                reference: p.reference,
              })),
            },
          },
          include: { items: true, payments: true, cashier: true, customer: true, branch: true, department: true },
        });

        for (const saleItem of sale.items) {
          const product = productMap.get(saleItem.productId)!;
          const recipeLines = await tx.productRecipeLine.findMany({
            where: { tenantId, parentProductId: product.id },
          });

          if (recipeLines.length > 0 || product.itemType === "prepared") {
            // Prepared / recipe: deduct ingredients only (never the menu item itself)
            for (const rl of recipeLines) {
              const qty = Math.ceil(Number(rl.quantity) * saleItem.quantity);
              if (qty <= 0) continue;
              const correlationId = `recipe:${saleItem.id}:${rl.ingredientProductId}`;
              const existingMove = await tx.stockMovement.findFirst({
                where: { tenantId, correlationId },
              });
              if (existingMove) continue;
              await this.inventory.applyMovementInTx(
                tx,
                tenantId,
                {
                  warehouseId: warehouse.id,
                  productId: rl.ingredientProductId,
                  type: "sale",
                  quantityDelta: -qty,
                  branchId: input.branchId,
                  referenceType: "sale_recipe",
                  referenceId: sale.id,
                  correlationId,
                  deviceId: input.deviceId ?? null,
                  reason: `Recipe for ${product.sku}`,
                },
                cashierUserId,
                policy,
              );
            }
          } else if (product.trackInventory) {
            await this.inventory.applyMovementInTx(
              tx,
              tenantId,
              {
                warehouseId: warehouse.id,
                productId: product.id,
                type: "sale",
                quantityDelta: -saleItem.quantity,
                branchId: input.branchId,
                referenceType: "sale",
                referenceId: sale.id,
                correlationId: `sale-item:${saleItem.id}`,
                deviceId: input.deviceId ?? null,
              },
              cashierUserId,
              policy,
            );
          }
        }

        const foodOrder =
          input.orderType === "dine_in" ||
          input.orderType === "takeaway" ||
          input.orderType === "delivery";
        if (foodOrder && sale.items.length) {
          await tx.kitchenTicket.create({
            data: {
              tenantId,
              branchId: input.branchId,
              departmentId,
              saleId: sale.id,
              tableCode: input.tableCode ?? null,
              status: "queued",
              items: {
                create: sale.items.map((si) => ({
                  tenantId,
                  saleItemId: si.id,
                  productId: si.productId,
                  nameSnapshot: si.nameSnapshot,
                  quantity: si.quantity,
                  status: "queued",
                })),
              },
            },
          });
        }

        return sale;
      });
      if (input.orderType === "dine_in" && input.tableCode) {
        // Paid dine-in frees the check binding; table goes dirty for reset, not free mid-service.
        await this.dining.setStatusByCode(tenantId, input.branchId, input.tableCode, "dirty");
      }
      return created;
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

  /**
   * Resolve department from explicit id, device assignment, or membership.
   * Never trusts an arbitrary foreign departmentId without tenant checks.
   */
  private async resolveDepartmentId(
    tenantId: string,
    userId: string,
    branchId: string,
    requestedId?: string,
    deviceId?: string,
  ): Promise<string | null> {
    let candidate = requestedId ?? null;

    if (!candidate && deviceId) {
      const link = await this.prisma.departmentDevice.findFirst({
        where: { tenantId, deviceId },
        include: { department: true },
      });
      if (link) candidate = link.departmentId;
    }

    if (!candidate) {
      const membership = await this.prisma.departmentMember.findFirst({
        where: { tenantId, userId },
        orderBy: { createdAt: "asc" },
      });
      if (membership) candidate = membership.departmentId;
    }

    if (!candidate) return null;

    const dept = await this.prisma.department.findFirst({
      where: { id: candidate, tenantId, status: "active" },
    });
    if (!dept) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Department not found for tenant",
      });
    }
    if (dept.branchId && dept.branchId !== branchId) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Department does not belong to this branch",
      });
    }

    const memberships = await this.prisma.departmentMember.findMany({
      where: { tenantId, userId },
      select: { departmentId: true },
    });
    if (memberships.length > 0 && !memberships.some((m) => m.departmentId === dept.id)) {
      throw new UnprocessableEntityException({
        code: "FORBIDDEN_DEPARTMENT",
        message: "Cashier is not assigned to this department",
      });
    }

    return dept.id;
  }
}
