import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, opts: { limit?: number; cursor?: string; q?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);
    const rows = await this.prisma.customer.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(cursor ? { id: { gt: cursor.id } } : {}),
        ...(opts.q
          ? {
              OR: [
                { name: { contains: opts.q, mode: "insensitive" } },
                { phone: { contains: opts.q } },
                { email: { contains: opts.q, mode: "insensitive" } },
              ],
            }
          : {}),
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
    const row = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Customer not found" });
    return row;
  }

  async create(
    tenantId: string,
    input: { name: string; phone?: string; email?: string },
    userId?: string,
  ) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: { name?: string; phone?: string; email?: string; status?: string },
    userId?: string,
  ) {
    await this.get(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { ...input, updatedBy: userId, version: { increment: 1 } },
    });
  }
}
