import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, userId: string) {
    const rows = await this.prisma.announcement.findMany({
      where: { tenantId },
      include: { reads: { where: { userId } }, author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      ...row,
      read: row.reads.length > 0,
      reads: undefined,
    }));
  }

  async create(
    tenantId: string,
    authorId: string,
    input: { title: string; body: string; audience?: string; branchId?: string },
  ) {
    return this.prisma.announcement.create({
      data: {
        tenantId,
        authorId,
        title: input.title,
        body: input.body,
        audience: input.audience ?? "all",
        branchId: input.branchId,
      },
    });
  }

  async markRead(tenantId: string, id: string, userId: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Message not found" });
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      create: { announcementId: id, userId },
      update: { readAt: new Date() },
    });
    return { ok: true };
  }
}
