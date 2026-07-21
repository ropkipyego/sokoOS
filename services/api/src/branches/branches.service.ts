import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, opts: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);

    const rows = await this.prisma.branch.findMany({
      where: {
        tenantId,
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

  async get(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!branch) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Branch not found" });
    }
    return branch;
  }

  async create(
    tenantId: string,
    input: { name: string; code: string; address?: object },
    userId?: string,
  ) {
    try {
      return await this.prisma.branch.create({
        data: {
          tenantId,
          name: input.name,
          code: input.code,
          address: input.address ?? undefined,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    } catch {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Branch code already exists",
      });
    }
  }

  async update(
    tenantId: string,
    id: string,
    input: { name?: string; status?: string; settings?: object },
    userId?: string,
  ) {
    await this.get(tenantId, id);
    return this.prisma.branch.update({
      where: { id },
      data: {
        name: input.name,
        status: input.status,
        settings: input.settings,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });
  }

  async archive(tenantId: string, id: string, userId?: string) {
    return this.update(tenantId, id, { status: "archived" }, userId);
  }
}
