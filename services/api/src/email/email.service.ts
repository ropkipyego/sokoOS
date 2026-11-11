import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { createMailAdapter, type MailAdapter } from "./mail.adapter";
import { renderTemplate, type TemplateContext } from "./email.templates";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly adapter: MailAdapter;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.adapter = createMailAdapter({
      MAIL_PROVIDER: config.get<string>("MAIL_PROVIDER"),
      SMTP_URL: config.get<string>("SMTP_URL"),
    });
    this.logger.log(`Mail adapter: ${this.adapter.name}`);
  }

  async enqueue(input: {
    templateKey: string;
    toEmail: string;
    toName?: string;
    context: TemplateContext;
    tenantId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.idempotencyKey) {
      const existing = await this.prisma.emailMessage.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }
    const rendered = renderTemplate(input.templateKey, input.context);
    return this.prisma.emailMessage.create({
      data: {
        tenantId: input.tenantId ?? null,
        templateKey: input.templateKey,
        toEmail: input.toEmail.toLowerCase(),
        toName: input.toName,
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        status: "queued",
        provider: this.adapter.name,
        idempotencyKey: input.idempotencyKey,
        metadata: (input.metadata ?? {}) as object,
      },
    });
  }

  /** Process a single queued message. Provider accept → sent (not delivered). */
  async processOne(id: string) {
    const msg = await this.prisma.emailMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException({ code: "EMAIL_NOT_FOUND", message: "Not found" });
    if (["delivered", "suppressed"].includes(msg.status)) return msg;
    if (msg.status === "bounced") return msg;

    await this.prisma.emailMessage.update({
      where: { id },
      data: { status: "processing", attemptCount: { increment: 1 } },
    });

    const result = await this.adapter.send({
      to: msg.toEmail,
      toName: msg.toName ?? undefined,
      subject: msg.subject,
      text: msg.bodyText,
      html: msg.bodyHtml ?? undefined,
    });

    if (result.accepted) {
      return this.prisma.emailMessage.update({
        where: { id },
        data: {
          status: "sent",
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          lastError: null,
        },
      });
    }

    const attempts = msg.attemptCount + 1;
    const failed = attempts >= msg.maxAttempts;
    return this.prisma.emailMessage.update({
      where: { id },
      data: {
        status: failed ? "failed" : "retried",
        lastError: result.error ?? "send_rejected",
      },
    });
  }

  async processQueue(limit = 20) {
    const batch = await this.prisma.emailMessage.findMany({
      where: { status: { in: ["queued", "retried"] } },
      orderBy: { queuedAt: "asc" },
      take: limit,
    });
    const results = [];
    for (const m of batch) {
      results.push(await this.processOne(m.id));
    }
    return { processed: results.length, results };
  }

  async list(filters?: { status?: string; q?: string }) {
    return this.prisma.emailMessage.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.q
          ? {
              OR: [
                { toEmail: { contains: filters.q, mode: "insensitive" } },
                { subject: { contains: filters.q, mode: "insensitive" } },
                { templateKey: { contains: filters.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        tenantId: true,
        templateKey: true,
        toEmail: true,
        toName: true,
        subject: true,
        status: true,
        provider: true,
        providerMessageId: true,
        attemptCount: true,
        lastError: true,
        queuedAt: true,
        sentAt: true,
        deliveredAt: true,
        createdAt: true,
        // body omitted from list — may contain sensitive links
      },
    });
  }

  /**
   * Mark delivered only with provider evidence (webhook). Never invent.
   */
  async markDelivered(id: string, evidence: { providerMessageId?: string }) {
    const msg = await this.prisma.emailMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException({ code: "EMAIL_NOT_FOUND", message: "Not found" });
    if (msg.status !== "sent" && msg.status !== "delivered") {
      return msg;
    }
    return this.prisma.emailMessage.update({
      where: { id },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
        providerMessageId: evidence.providerMessageId ?? msg.providerMessageId,
      },
    });
  }
}
