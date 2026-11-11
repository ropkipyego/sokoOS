import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

@Injectable()
export class DiningService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, branchId?: string) {
    return this.prisma.diningTable.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });
  }

  async floor(tenantId: string, branchId: string) {
    const tables = await this.prisma.diningTable.findMany({
      where: { tenantId, branchId },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });
    const openSaleIds = tables.map((t) => t.currentSaleId).filter(Boolean) as string[];
    const openSales = openSaleIds.length
      ? await this.prisma.sale.findMany({
          where: { tenantId, id: { in: openSaleIds } },
          include: { items: true, payments: true, cashier: { select: { id: true, name: true } } },
        })
      : [];
    const saleMap = new Map(openSales.map((s) => [s.id, s]));
    const sections = [...new Set(tables.map((t) => t.section ?? "Main"))];
    return {
      sections,
      tables: tables.map((t) => ({
        ...t,
        openCheck: t.currentSaleId ? saleMap.get(t.currentSaleId) ?? null : null,
      })),
    };
  }

  async upsertMany(
    tenantId: string,
    branchId: string,
    tables: Array<{
      code: string;
      label?: string;
      seats?: number;
      sortOrder?: number;
      section?: string;
      departmentId?: string;
    }>,
  ) {
    const out = [];
    for (const [i, t] of tables.entries()) {
      const row = await this.prisma.diningTable.upsert({
        where: {
          tenantId_branchId_code: { tenantId, branchId, code: t.code },
        },
        create: {
          tenantId,
          branchId,
          code: t.code,
          label: t.label ?? t.code,
          seats: t.seats ?? 4,
          sortOrder: t.sortOrder ?? i,
          section: t.section ?? "Main",
          departmentId: t.departmentId,
          status: "free",
        },
        update: {
          label: t.label ?? t.code,
          seats: t.seats ?? 4,
          sortOrder: t.sortOrder ?? i,
          section: t.section ?? undefined,
          departmentId: t.departmentId,
        },
      });
      out.push(row);
    }
    return out;
  }

  async setStatus(tenantId: string, id: string, status: string) {
    const table = await this.prisma.diningTable.findFirst({ where: { id, tenantId } });
    if (!table) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Table not found" });
    }
    const allowed = new Set(["free", "occupied", "reserved", "dirty"]);
    if (!allowed.has(status)) {
      throw new ConflictException({ code: "VALIDATION_FAILED", message: "Invalid table status" });
    }
    return this.prisma.diningTable.update({
      where: { id },
      data: {
        status,
        ...(status === "free" ? { currentSaleId: null, waiterUserId: null } : {}),
      },
    });
  }

  async setStatusByCode(tenantId: string, branchId: string, code: string, status: string) {
    const table = await this.prisma.diningTable.findFirst({
      where: { tenantId, branchId, code },
    });
    if (!table) return null;
    return this.prisma.diningTable.update({
      where: { id: table.id },
      data: {
        status,
        ...(status === "free" ? { currentSaleId: null, waiterUserId: null } : {}),
      },
    });
  }

  async assignWaiter(tenantId: string, tableId: string, waiterUserId: string | null) {
    const table = await this.prisma.diningTable.findFirst({ where: { id: tableId, tenantId } });
    if (!table) throw new NotFoundException({ code: "NOT_FOUND", message: "Table not found" });
    if (waiterUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: waiterUserId, tenantId } });
      if (!user) throw new NotFoundException({ code: "NOT_FOUND", message: "Waiter not found" });
    }
    const updated = await this.prisma.diningTable.update({
      where: { id: tableId },
      data: { waiterUserId },
    });
    if (table.currentSaleId) {
      await this.prisma.sale.update({
        where: { id: table.currentSaleId },
        data: { waiterUserId },
      });
    }
    return updated;
  }

  /**
   * Open a dine-in check on a free table. Does not deduct inventory until send/close
   * when items are finalized via sales.create with completed payments — here we create
   * an open sale shell; items added separately.
   */
  async openCheck(
    tenantId: string,
    userId: string,
    input: {
      branchId: string;
      tableId: string;
      departmentId?: string;
      waiterUserId?: string;
      currency?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const table = await tx.diningTable.findFirst({
        where: { id: input.tableId, tenantId, branchId: input.branchId },
      });
      if (!table) throw new NotFoundException({ code: "NOT_FOUND", message: "Table not found" });
      if (table.status === "occupied" && table.currentSaleId) {
        throw new ConflictException({ code: "CONFLICT", message: "Table already has an open check" });
      }
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      const branch = await tx.branch.findFirst({ where: { id: input.branchId, tenantId } });
      if (!branch) throw new NotFoundException({ code: "NOT_FOUND", message: "Branch not found" });
      const cashier = await tx.user.findFirst({ where: { id: userId } });
      const receiptNumber = `OPEN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4)}`;
      const sale = await tx.sale.create({
        data: {
          tenantId,
          branchId: input.branchId,
          cashierUserId: userId,
          status: "open",
          subtotalMinor: 0,
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: 0,
          deliveryFeeMinor: 0,
          currency: input.currency ?? tenant?.currency ?? "KES",
          receiptNumber,
          orderType: "dine_in",
          tableCode: table.code,
          departmentId: input.departmentId ?? table.departmentId,
          waiterUserId: input.waiterUserId ?? table.waiterUserId ?? userId,
          checkStatus: "open",
          cashierNameSnapshot: cashier?.name ?? null,
          branchNameSnapshot: branch.name,
          occurredAt: new Date(),
          createdBy: userId,
        },
        include: { items: true, payments: true },
      });
      await tx.diningTable.update({
        where: { id: table.id },
        data: {
          status: "occupied",
          currentSaleId: sale.id,
          waiterUserId: sale.waiterUserId,
        },
      });
      return sale;
    });
  }

  async addItems(
    tenantId: string,
    saleId: string,
    items: Array<{ productId: string; quantity: number; unitPriceMinor?: number; notes?: string }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { items: true },
      });
      if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Check not found" });
      if (sale.status !== "open" && sale.checkStatus !== "open" && sale.checkStatus !== "sent_to_kitchen") {
        throw new ConflictException({ code: "CONFLICT", message: "Check is not open for new items" });
      }
      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, tenantId } });
        if (!product) throw new NotFoundException({ code: "NOT_FOUND", message: "Product not found" });
        const unit = item.unitPriceMinor ?? product.priceMinor;
        await tx.saleItem.create({
          data: {
            tenantId,
            saleId,
            productId: product.id,
            nameSnapshot: product.name,
            skuSnapshot: product.sku,
            quantity: item.quantity,
            unitPriceMinor: unit,
            discountMinor: 0,
            taxMinor: 0,
            lineTotalMinor: unit * item.quantity,
            extensions: item.notes ? { notes: item.notes } : {},
          },
        });
      }
      const refreshed = await tx.saleItem.findMany({ where: { saleId } });
      const subtotal = refreshed.reduce((s, l) => s + l.lineTotalMinor, 0);
      return tx.sale.update({
        where: { id: saleId },
        data: { subtotalMinor: subtotal, totalMinor: subtotal - sale.discountMinor, checkStatus: "open" },
        include: { items: true, payments: true },
      });
    });
  }

  async sendToKitchen(tenantId: string, saleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { items: true },
      });
      if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Check not found" });
      if (!sale.items.length) {
        throw new BadRequestException({ code: "VALIDATION_FAILED", message: "No items to send" });
      }
      const existing = await tx.kitchenTicket.findFirst({
        where: { tenantId, saleId, status: { in: ["queued", "preparing", "ready"] } },
      });
      if (!existing) {
        await tx.kitchenTicket.create({
          data: {
            tenantId,
            branchId: sale.branchId,
            departmentId: sale.departmentId,
            saleId: sale.id,
            tableCode: sale.tableCode,
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
      return tx.sale.update({
        where: { id: saleId },
        data: { checkStatus: "sent_to_kitchen" },
        include: { items: true, kitchenTickets: true },
      });
    });
  }

  async transferTable(tenantId: string, saleId: string, toTableId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({ where: { id: saleId, tenantId } });
      if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Check not found" });
      if (sale.status === "completed" || sale.status === "voided") {
        throw new ConflictException({ code: "CONFLICT", message: "Cannot transfer closed check" });
      }
      const toTable = await tx.diningTable.findFirst({
        where: { id: toTableId, tenantId, branchId: sale.branchId },
      });
      if (!toTable) throw new NotFoundException({ code: "NOT_FOUND", message: "Target table not found" });
      if (toTable.currentSaleId && toTable.currentSaleId !== saleId) {
        throw new ConflictException({ code: "CONFLICT", message: "Target table is occupied" });
      }
      const fromTable = await tx.diningTable.findFirst({
        where: { tenantId, branchId: sale.branchId, code: sale.tableCode ?? "" },
      });
      if (fromTable) {
        await tx.diningTable.update({
          where: { id: fromTable.id },
          data: { status: "dirty", currentSaleId: null },
        });
      }
      await tx.diningTable.update({
        where: { id: toTable.id },
        data: { status: "occupied", currentSaleId: saleId, waiterUserId: sale.waiterUserId },
      });
      return tx.sale.update({
        where: { id: saleId },
        data: { tableCode: toTable.code },
        include: { items: true },
      });
    });
  }

  /**
   * Split selected items onto a new open check (same table). Does not create revenue —
   * both checks remain open until paid. Original line quantities reduced / removed.
   */
  async splitByItems(
    tenantId: string,
    saleId: string,
    userId: string,
    itemSplits: Array<{ saleItemId: string; quantity: number }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { items: true },
      });
      if (!sale || sale.status === "completed") {
        throw new ConflictException({ code: "CONFLICT", message: "Check not splittable" });
      }
      if (!itemSplits.length) {
        throw new BadRequestException({ code: "VALIDATION_FAILED", message: "No items selected" });
      }

      const receiptNumber = `SPLIT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4)}`;
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          branchId: sale.branchId,
          cashierUserId: userId,
          status: "open",
          subtotalMinor: 0,
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: 0,
          deliveryFeeMinor: 0,
          currency: sale.currency,
          receiptNumber,
          orderType: sale.orderType,
          tableCode: sale.tableCode,
          departmentId: sale.departmentId,
          waiterUserId: sale.waiterUserId,
          checkStatus: "open",
          cashierNameSnapshot: sale.cashierNameSnapshot,
          branchNameSnapshot: sale.branchNameSnapshot,
          occurredAt: new Date(),
          createdBy: userId,
        },
      });

      let newSub = 0;
      for (const split of itemSplits) {
        const line = sale.items.find((i) => i.id === split.saleItemId);
        if (!line) throw new NotFoundException({ code: "NOT_FOUND", message: "Sale item not found" });
        if (split.quantity < 1 || split.quantity > line.quantity) {
          throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Invalid split quantity" });
        }
        const moveTotal = Math.round((line.lineTotalMinor / line.quantity) * split.quantity);
        await tx.saleItem.create({
          data: {
            tenantId,
            saleId: newSale.id,
            productId: line.productId,
            nameSnapshot: line.nameSnapshot,
            skuSnapshot: line.skuSnapshot,
            quantity: split.quantity,
            unitPriceMinor: line.unitPriceMinor,
            discountMinor: 0,
            taxMinor: 0,
            lineTotalMinor: moveTotal,
          },
        });
        newSub += moveTotal;
        const remain = line.quantity - split.quantity;
        if (remain === 0) {
          await tx.saleItem.delete({ where: { id: line.id } });
        } else {
          await tx.saleItem.update({
            where: { id: line.id },
            data: {
              quantity: remain,
              lineTotalMinor: line.lineTotalMinor - moveTotal,
            },
          });
        }
      }

      const origItems = await tx.saleItem.findMany({ where: { saleId } });
      const origSub = origItems.reduce((s, l) => s + l.lineTotalMinor, 0);
      await tx.sale.update({
        where: { id: saleId },
        data: { subtotalMinor: origSub, totalMinor: origSub - sale.discountMinor },
      });
      const updatedNew = await tx.sale.update({
        where: { id: newSale.id },
        data: { subtotalMinor: newSub, totalMinor: newSub },
        include: { items: true },
      });
      return {
        original: await tx.sale.findFirst({
          where: { id: saleId },
          include: { items: true },
        }),
        split: updatedNew,
      };
    });
  }

  /** Merge source open check into target — items move; source voided; no extra revenue. */
  async mergeChecks(tenantId: string, sourceSaleId: string, targetSaleId: string) {
    if (sourceSaleId === targetSaleId) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Cannot merge check into itself" });
    }
    return this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.sale.findFirst({ where: { id: sourceSaleId, tenantId }, include: { items: true } }),
        tx.sale.findFirst({ where: { id: targetSaleId, tenantId }, include: { items: true } }),
      ]);
      if (!source || !target) throw new NotFoundException({ code: "NOT_FOUND", message: "Check not found" });
      if (source.status === "completed" || target.status === "completed") {
        throw new ConflictException({ code: "CONFLICT", message: "Cannot merge completed checks" });
      }
      for (const item of source.items) {
        await tx.saleItem.create({
          data: {
            tenantId,
            saleId: target.id,
            productId: item.productId,
            nameSnapshot: item.nameSnapshot,
            skuSnapshot: item.skuSnapshot,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            discountMinor: item.discountMinor,
            taxMinor: item.taxMinor,
            lineTotalMinor: item.lineTotalMinor,
          },
        });
        await tx.saleItem.delete({ where: { id: item.id } });
      }
      const items = await tx.saleItem.findMany({ where: { saleId: target.id } });
      const sub = items.reduce((s, l) => s + l.lineTotalMinor, 0);
      await tx.sale.update({
        where: { id: target.id },
        data: { subtotalMinor: sub, totalMinor: sub - target.discountMinor },
      });
      await tx.sale.update({
        where: { id: source.id },
        data: { status: "voided", checkStatus: "voided", totalMinor: 0, subtotalMinor: 0 },
      });
      const sourceTable = await tx.diningTable.findFirst({
        where: { tenantId, currentSaleId: source.id },
      });
      if (sourceTable) {
        await tx.diningTable.update({
          where: { id: sourceTable.id },
          data: { status: "dirty", currentSaleId: null },
        });
      }
      return tx.sale.findFirst({
        where: { id: target.id },
        include: { items: true },
      });
    });
  }

  /**
   * Close check after payment recorded. Inventory deduction for prepared/stock items
   * happens here once via correlation ids (idempotent).
   */
  async closeCheck(
    tenantId: string,
    saleId: string,
    payments: Array<{ method: string; amountMinor: number; reference?: string }>,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { items: true, payments: true },
      });
      if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Check not found" });
      if (sale.status === "completed") return sale;
      const paySum = payments.reduce((s, p) => s + p.amountMinor, 0);
      if (paySum < sale.totalMinor) {
        throw new BadRequestException({
          code: "VALIDATION_FAILED",
          message: "Payments do not cover check total",
        });
      }
      for (const p of payments) {
        await tx.salePayment.create({
          data: {
            tenantId,
            saleId,
            method: p.method,
            amountMinor: p.amountMinor,
            status: "completed",
            reference: p.reference,
          },
        });
      }
      // Deduct inventory once per sale item correlation
      for (const item of sale.items) {
        const product = await tx.product.findFirst({ where: { id: item.productId } });
        if (!product) continue;
        const recipeLines = await tx.productRecipeLine.findMany({
          where: { tenantId, parentProductId: product.id },
        });
        const warehouse = await tx.warehouse.findFirst({
          where: { tenantId, branchId: sale.branchId, isDefault: true },
        });
        if (!warehouse) continue;
        if (recipeLines.length > 0 || product.itemType === "prepared") {
          for (const rl of recipeLines) {
            const correlationId = `recipe:${item.id}:${rl.ingredientProductId}`;
            const existing = await tx.stockMovement.findFirst({
              where: { tenantId, correlationId },
            });
            if (existing) continue;
            const qty = Math.ceil(Number(rl.quantity) * item.quantity);
            await tx.stockMovement.create({
              data: {
                tenantId,
                warehouseId: warehouse.id,
                productId: rl.ingredientProductId,
                type: "sale_recipe",
                quantityDelta: -qty,
                branchId: sale.branchId,
                referenceType: "sale_recipe",
                referenceId: sale.id,
                correlationId,
                createdBy: userId,
              },
            });
            await tx.stockBalance.upsert({
              where: {
                tenantId_warehouseId_productId: {
                  tenantId,
                  warehouseId: warehouse.id,
                  productId: rl.ingredientProductId,
                },
              },
              create: {
                tenantId,
                warehouseId: warehouse.id,
                productId: rl.ingredientProductId,
                quantity: -qty,
              },
              update: { quantity: { decrement: qty } },
            });
          }
        } else if (product.trackInventory) {
          const correlationId = `sale-item:${item.id}`;
          const existing = await tx.stockMovement.findFirst({
            where: { tenantId, correlationId },
          });
          if (existing) continue;
          await tx.stockMovement.create({
            data: {
              tenantId,
              warehouseId: warehouse.id,
              productId: product.id,
              type: "sale",
              quantityDelta: -item.quantity,
              branchId: sale.branchId,
              referenceType: "sale",
              referenceId: sale.id,
              correlationId,
              createdBy: userId,
            },
          });
          await tx.stockBalance.upsert({
            where: {
              tenantId_warehouseId_productId: {
                tenantId,
                warehouseId: warehouse.id,
                productId: product.id,
              },
            },
            create: {
              tenantId,
              warehouseId: warehouse.id,
              productId: product.id,
              quantity: -item.quantity,
            },
            update: { quantity: { decrement: item.quantity } },
          });
        }
      }

      const closed = await tx.sale.update({
        where: { id: saleId },
        data: { status: "completed", checkStatus: "completed" },
        include: { items: true, payments: true },
      });
      if (sale.tableCode) {
        await tx.diningTable.updateMany({
          where: { tenantId, branchId: sale.branchId, code: sale.tableCode },
          data: { status: "dirty", currentSaleId: null },
        });
      }
      return closed;
    });
  }
}
