import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

const STATUSES = ["PENDING", "ASSIGNED", "DISPATCHED", "DELIVERED", "CANCELLED"] as const;

@Injectable()
export class DeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, opts: { status?: string; branchId?: string; limit?: number; cursor?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);
    const rows = await this.prisma.delivery.findMany({
      where: {
        tenantId,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(cursor ? { id: { gt: cursor.id } } : {}),
      },
      include: { sale: true, customer: true, assignee: true, events: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return { data, meta: paginateMeta(hasMore, limit, last ? encodeCursor({ id: last.id }) : null) };
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.delivery.findFirst({
      where: { id, tenantId },
      include: { sale: { include: { items: true, payments: true } }, customer: true, assignee: true, events: true },
    });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Delivery not found" });
    return row;
  }

  async create(
    tenantId: string,
    input: {
      saleId: string;
      phone?: string;
      address?: string;
      location?: string;
      feeMinor?: number;
      instructions?: string;
      assigneeUserId?: string;
      customerId?: string;
    },
    userId?: string,
  ) {
    const sale = await this.prisma.sale.findFirst({ where: { id: input.saleId, tenantId } });
    if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });

    const status = input.assigneeUserId ? "ASSIGNED" : "PENDING";
    return this.prisma.delivery.create({
      data: {
        tenantId,
        branchId: sale.branchId,
        saleId: sale.id,
        customerId: input.customerId ?? sale.customerId,
        phone: input.phone,
        address: input.address,
        location: input.location,
        feeMinor: input.feeMinor ?? sale.deliveryFeeMinor,
        instructions: input.instructions,
        assigneeUserId: input.assigneeUserId,
        status,
        createdBy: userId,
        events: {
          create: { tenantId, status, note: "Delivery created", createdBy: userId },
        },
      },
      include: { events: true, customer: true, assignee: true, sale: true },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    input: { status: string; note?: string; assigneeUserId?: string },
    userId?: string,
  ) {
    if (!STATUSES.includes(input.status as (typeof STATUSES)[number])) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: `Status must be one of ${STATUSES.join(", ")}`,
      });
    }
    await this.get(tenantId, id);
    const now = new Date();
    return this.prisma.delivery.update({
      where: { id },
      data: {
        status: input.status,
        assigneeUserId: input.assigneeUserId,
        dispatchedAt: input.status === "DISPATCHED" ? now : undefined,
        completedAt: input.status === "DELIVERED" || input.status === "CANCELLED" ? now : undefined,
        events: {
          create: { tenantId, status: input.status, note: input.note, createdBy: userId },
        },
      },
      include: { events: true, customer: true, assignee: true, sale: true },
    });
  }
}
