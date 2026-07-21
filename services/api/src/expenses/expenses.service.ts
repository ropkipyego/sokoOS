import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantsService } from "../tenants/tenants.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  async list(
    tenantId: string,
    opts: { limit?: number; cursor?: string; branchId?: string; from?: string; to?: string } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);
    const rows = await this.prisma.expense.findMany({
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
    const row = await this.prisma.expense.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Expense not found" });
    return row;
  }

  async create(
    tenantId: string,
    input: {
      branchId: string;
      category: string;
      amountMinor: number;
      currency?: string;
      notes?: string;
      occurredAt?: string;
    },
    userId?: string,
  ) {
    const tenant = await this.tenants.getCurrent(tenantId);
    return this.prisma.expense.create({
      data: {
        tenantId,
        branchId: input.branchId,
        category: input.category,
        amountMinor: input.amountMinor,
        currency: input.currency ?? tenant.currency,
        notes: input.notes,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: {
      category?: string;
      amountMinor?: number;
      notes?: string | null;
    },
    userId?: string,
  ) {
    await this.get(tenantId, id);
    return this.prisma.expense.update({
      where: { id },
      data: { ...input, updatedBy: userId, version: { increment: 1 } },
    });
  }
}
