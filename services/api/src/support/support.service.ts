import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(input: {
    tenantId?: string | null;
    origin: "platform" | "tenant";
    subject: string;
    category?: string;
    priority?: string;
    body: string;
    requesterUserId?: string;
    requesterEmail?: string;
  }) {
    if (!input.subject?.trim() || !input.body?.trim()) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Subject and body required",
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          tenantId: input.tenantId ?? null,
          origin: input.origin,
          subject: input.subject.trim(),
          category: input.category ?? "general",
          priority: input.priority ?? "normal",
          status: "open",
          requesterUserId: input.requesterUserId,
          requesterEmail: input.requesterEmail,
        },
      });
      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorUserId: input.requesterUserId,
          authorEmail: input.requesterEmail,
          authorRole: input.origin === "platform" ? "agent" : "customer",
          body: input.body.trim(),
          isInternal: false,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId ?? null,
          actorUserId: input.requesterUserId ?? null,
          action: "support.ticket.create",
          entityType: "support_ticket",
          entityId: ticket.id,
          metadata: { subject: ticket.subject },
        },
      });
      return ticket;
    });
  }

  listPlatform(filters?: { status?: string }) {
    return this.prisma.supportTicket.findMany({
      where: filters?.status ? { status: filters.status } : undefined,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: { _count: { select: { messages: true } } },
    });
  }

  listTenant(tenantId: string) {
    return this.prisma.supportTicket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });
  }

  async getForPlatform(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) throw new NotFoundException({ code: "NOT_FOUND", message: "Ticket not found" });
    return ticket;
  }

  async getForTenant(id: string, tenantId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, tenantId },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!ticket) throw new NotFoundException({ code: "NOT_FOUND", message: "Ticket not found" });
    return ticket;
  }

  async addMessage(
    ticketId: string,
    input: {
      body: string;
      authorUserId?: string;
      authorEmail?: string;
      authorRole: "customer" | "agent" | "system";
      isInternal?: boolean;
      tenantId?: string | null;
      platformActor: boolean;
    },
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException({ code: "NOT_FOUND", message: "Ticket not found" });
    if (!input.platformActor) {
      if (!input.tenantId || ticket.tenantId !== input.tenantId) {
        throw new ForbiddenException({ code: "FORBIDDEN", message: "Cross-tenant support access denied" });
      }
      if (input.isInternal) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Tenant users cannot create internal notes",
        });
      }
    }
    const msg = await this.prisma.supportMessage.create({
      data: {
        ticketId,
        body: input.body.trim(),
        authorUserId: input.authorUserId,
        authorEmail: input.authorEmail,
        authorRole: input.authorRole,
        isInternal: Boolean(input.isInternal),
      },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: input.authorRole === "customer" ? "open" : "pending",
        updatedAt: new Date(),
      },
    });
    return msg;
  }

  async updateStatus(
    ticketId: string,
    status: string,
    actorUserId: string,
    opts?: { assigneeUserId?: string },
  ) {
    const allowed = ["open", "pending", "waiting_customer", "resolved", "closed"];
    if (!allowed.includes(status)) {
      throw new BadRequestException({ code: "INVALID_STATUS", message: "Invalid status" });
    }
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        assigneeUserId: opts?.assigneeUserId,
        resolvedAt: status === "resolved" || status === "closed" ? new Date() : null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: updated.tenantId,
        actorUserId,
        action: "support.ticket.status",
        entityType: "support_ticket",
        entityId: ticketId,
        metadata: { status },
      },
    });
    return updated;
  }
}
