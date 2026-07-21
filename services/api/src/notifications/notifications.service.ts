import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    userId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        userId,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, tenantId, userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Notification not found",
      });
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async create(
    tenantId: string,
    userId: string,
    input: { type: string; body: string },
  ) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: input.type,
        body: input.body,
      },
    });
  }
}
