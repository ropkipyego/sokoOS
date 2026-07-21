import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    opts: {
      limit?: number;
      cursor?: string;
      actorUserId?: string;
      entityType?: string;
      action?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(opts.actorUserId ? { actorUserId: opts.actorUserId } : {}),
        ...(opts.entityType ? { entityType: opts.entityType } : {}),
        ...(opts.action ? { action: { contains: opts.action } } : {}),
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
}
