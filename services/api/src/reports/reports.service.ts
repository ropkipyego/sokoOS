import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dailySummary(
    tenantId: string,
    opts: { date?: string; branchId?: string } = {},
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
      salesCount: saleCount,
      salesTotalMinor: salesAgg._sum.totalMinor ?? 0,
      taxMinor: salesAgg._sum.taxMinor ?? 0,
      discountMinor: salesAgg._sum.discountMinor ?? 0,
      expensesTotalMinor: expensesAgg._sum.amountMinor ?? 0,
      netMinor:
        (salesAgg._sum.totalMinor ?? 0) - (expensesAgg._sum.amountMinor ?? 0),
    };
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
}
