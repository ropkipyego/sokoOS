import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dailySummary(
    tenantId: string,
    opts: { date?: string; branchId?: string; departmentId?: string } = {},
  ) {
    const day = opts.date ? new Date(opts.date) : new Date();
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const salesWhere = {
      tenantId,
      status: "completed",
      occurredAt: { gte: start, lt: end },
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
    };

    const [salesAgg, saleCount, expensesAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: salesWhere,
        _sum: { totalMinor: true, taxMinor: true, discountMinor: true },
      }),
      this.prisma.sale.count({ where: salesWhere }),
      this.prisma.expense.aggregate({
        where: {
          tenantId,
          occurredAt: { gte: start, lt: end },
          ...(opts.branchId ? { branchId: opts.branchId } : {}),
        },
        _sum: { amountMinor: true },
      }),
    ]);

    return {
      date: start.toISOString().slice(0, 10),
      branchId: opts.branchId ?? null,
      departmentId: opts.departmentId ?? null,
      salesCount: saleCount,
      salesTotalMinor: salesAgg._sum.totalMinor ?? 0,
      taxMinor: salesAgg._sum.taxMinor ?? 0,
      discountMinor: salesAgg._sum.discountMinor ?? 0,
      expensesTotalMinor: expensesAgg._sum.amountMinor ?? 0,
      netMinor:
        (salesAgg._sum.totalMinor ?? 0) - (expensesAgg._sum.amountMinor ?? 0),
    };
  }

  /**
   * Finance summary. Folio postings and stock transfers are not counted as revenue.
   * COGS uses product costMinor × sold qty for completed sales in range.
   */
  async financeSummary(
    tenantId: string,
    opts: { from?: string; to?: string; branchId?: string; departmentId?: string } = {},
  ) {
    const where = {
      tenantId,
      status: "completed",
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
    };

    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        id: true,
        totalMinor: true,
        items: { select: { quantity: true, productId: true, product: { select: { costMinor: true } } } },
        payments: { select: { method: true, amountMinor: true, status: true } },
      },
      take: 5000,
    });

    let revenueMinor = 0;
    let cogsMinor = 0;
    const cashCollected: Record<string, number> = {};
    for (const sale of sales) {
      revenueMinor += sale.totalMinor;
      for (const item of sale.items) {
        cogsMinor += (item.product.costMinor ?? 0) * item.quantity;
      }
      for (const p of sale.payments) {
        if (p.status !== "completed" || p.method === "room_charge") continue;
        cashCollected[p.method] = (cashCollected[p.method] ?? 0) + p.amountMinor;
      }
    }

    const expensesAgg = await this.prisma.expense.aggregate({
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
      },
      _sum: { amountMinor: true },
    });
    const expensesMinor = expensesAgg._sum.amountMinor ?? 0;
    const grossProfitMinor = revenueMinor - cogsMinor;
    const netProfitMinor = grossProfitMinor - expensesMinor;

    const inventory = await this.prisma.stockBalance.findMany({
      where: { tenantId, ...(opts.branchId ? { warehouse: { branchId: opts.branchId } } : {}) },
      include: { product: { select: { costMinor: true } } },
      take: 10000,
    });
    const inventoryValuationMinor = inventory.reduce(
      (s, b) => s + b.quantity * (b.product.costMinor ?? 0),
      0,
    );

    return {
      revenueMinor,
      cogsMinor,
      grossProfitMinor,
      expensesMinor,
      netProfitMinor,
      cashCollected,
      inventoryValuationMinor,
      salesCount: sales.length,
      notes: [
        "Folio charges link existing sales and are not additional revenue.",
        "Stock transfers are not sales.",
        "room_charge payments excluded from cash collected.",
      ],
    };
  }

  async departmentSales(
    tenantId: string,
    opts: { from?: string; to?: string; branchId?: string } = {},
  ) {
    const where = {
      tenantId,
      status: "completed",
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.from || opts.to
        ? {
            occurredAt: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lte: new Date(opts.to) } : {}),
            },
          }
        : {}),
    };
    const grouped = await this.prisma.sale.groupBy({
      by: ["departmentId"],
      where,
      _sum: { totalMinor: true, taxMinor: true, discountMinor: true },
      _count: { _all: true },
    });
    const deptIds = grouped.map((g) => g.departmentId).filter(Boolean) as string[];
    const depts = await this.prisma.department.findMany({
      where: { tenantId, id: { in: deptIds } },
      select: { id: true, code: true, name: true },
    });
    const map = new Map(depts.map((d) => [d.id, d]));
    return grouped.map((g) => ({
      departmentId: g.departmentId,
      department: g.departmentId ? map.get(g.departmentId) ?? null : null,
      salesCount: g._count._all,
      salesTotalMinor: g._sum.totalMinor ?? 0,
      taxMinor: g._sum.taxMinor ?? 0,
      discountMinor: g._sum.discountMinor ?? 0,
    }));
  }

  async lowStock(
    tenantId: string,
    opts: { threshold?: number; warehouseId?: string; limit?: number } = {},
  ) {
    const threshold = opts.threshold ?? 5;
    const limit = Math.min(opts.limit ?? 50, 200);

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        tenantId,
        quantity: { lte: threshold },
        ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
      },
      take: limit,
      orderBy: { quantity: "asc" },
    });

    const productIds = [...new Set(balances.map((b) => b.productId))];
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, sku: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return balances.map((b) => ({
      warehouseId: b.warehouseId,
      productId: b.productId,
      quantity: b.quantity,
      product: productMap.get(b.productId) ?? null,
      threshold,
    }));
  }

  async salesReport(
    tenantId: string,
    opts: { from?: string; to?: string; branchId?: string } = {},
  ) {
    const where = {
      tenantId,
      status: "completed",
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.from || opts.to
        ? {
            occurredAt: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lte: new Date(opts.to) } : {}),
            },
          }
        : {}),
    };

    const [agg, count] = await Promise.all([
      this.prisma.sale.aggregate({
        where,
        _sum: { totalMinor: true, taxMinor: true },
        _avg: { totalMinor: true },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      salesCount: count,
      totalMinor: agg._sum.totalMinor ?? 0,
      taxMinor: agg._sum.taxMinor ?? 0,
      averageMinor: Math.round(agg._avg.totalMinor ?? 0),
    };
  }

  async dashboard(
    tenantId: string,
    opts: { from?: string; to?: string; branchId?: string } = {},
  ) {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const branch = opts.branchId ? { branchId: opts.branchId } : {};
    const completed = { tenantId, status: "completed", ...branch };

    const [today, week, month, products, low, out, expenses, recent, topProducts, byTender] =
      await Promise.all([
        this.periodAgg(completed, startOfDay, now),
        this.periodAgg(completed, startOfWeek, now),
        this.periodAgg(completed, startOfMonth, now),
        this.prisma.product.count({ where: { tenantId, status: "active", archivedAt: null } }),
        this.prisma.stockBalance.count({ where: { tenantId, quantity: { lte: 5, gt: 0 } } }),
        this.prisma.stockBalance.count({ where: { tenantId, quantity: { lte: 0 } } }),
        this.prisma.expense.aggregate({
          where: { tenantId, occurredAt: { gte: startOfDay, lte: now }, ...branch },
          _sum: { amountMinor: true },
        }),
        this.prisma.sale.findMany({
          where: completed,
          include: { cashier: true, payments: true, branch: true },
          orderBy: { occurredAt: "desc" },
          take: 8,
        }),
        this.prisma.saleItem.groupBy({
          by: ["productId", "nameSnapshot"],
          where: { tenantId },
          _sum: { quantity: true, lineTotalMinor: true },
          orderBy: { _sum: { lineTotalMinor: "desc" } },
          take: 8,
        }),
        this.prisma.salePayment.groupBy({
          by: ["method"],
          where: { tenantId, status: "completed" },
          _sum: { amountMinor: true },
        }),
      ]);

    const cogs = await this.grossProfit(tenantId, startOfDay, now, opts.branchId);

    return {
      today,
      week,
      month,
      activeProducts: products,
      lowStock: low,
      outOfStock: out,
      expensesTodayMinor: expenses._sum.amountMinor ?? 0,
      grossProfitTodayMinor: cogs,
      recentSales: recent,
      topProducts,
      paymentBreakdown: byTender,
    };
  }

  async exportSalesCsv(tenantId: string, opts: { from?: string; to?: string; branchId?: string }) {
    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: "completed",
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(opts.from || opts.to
          ? {
              occurredAt: {
                ...(opts.from ? { gte: new Date(opts.from) } : {}),
                ...(opts.to ? { lte: new Date(opts.to) } : {}),
              },
            }
          : {}),
      },
      include: { cashier: true, branch: true, payments: true },
      orderBy: { occurredAt: "desc" },
      take: 2000,
    });
    const header = "receipt,date,branch,cashier,totalMinor,method";
    const lines = sales.map((s) =>
      [
        s.receiptNumber,
        s.occurredAt.toISOString(),
        s.branchNameSnapshot ?? s.branch?.name ?? "",
        s.cashierNameSnapshot ?? s.cashier?.name ?? "",
        s.totalMinor,
        s.payments.map((p) => p.method).join("|"),
      ].join(","),
    );
    return `${header}\n${lines.join("\n")}\n`;
  }

  private async periodAgg(
    where: { tenantId: string; status: string; branchId?: string },
    from: Date,
    to: Date,
  ) {
    const scoped = { ...where, occurredAt: { gte: from, lte: to } };
    const [agg, count] = await Promise.all([
      this.prisma.sale.aggregate({ where: scoped, _sum: { totalMinor: true } }),
      this.prisma.sale.count({ where: scoped }),
    ]);
    const total = agg._sum.totalMinor ?? 0;
    return {
      salesTotalMinor: total,
      salesCount: count,
      averageMinor: count ? Math.round(total / count) : 0,
    };
  }

  private async grossProfit(tenantId: string, from: Date, to: Date, branchId?: string) {
    const items = await this.prisma.saleItem.findMany({
      where: {
        tenantId,
        sale: {
          tenantId,
          status: "completed",
          occurredAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      },
      include: { product: { select: { costMinor: true } }, sale: { select: { totalMinor: true } } },
    });
    const revenue = items.reduce((s, i) => s + i.lineTotalMinor, 0);
    const cost = items.reduce((s, i) => s + (i.product.costMinor ?? 0) * i.quantity, 0);
    return revenue - cost;
  }
}
