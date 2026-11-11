import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementsService } from "./entitlements.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  listPlans(publicOnly = false) {
    return this.prisma.plan.findMany({
      where: {
        isActive: true,
        ...(publicOnly ? { isPublic: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { priceMinor: "asc" }],
    });
  }

  async upsertPlan(input: {
    code: string;
    name: string;
    description?: string;
    priceMinor: number;
    currency?: string;
    interval?: string;
    branchLimit?: number | null;
    userLimit?: number | null;
    deviceLimit?: number | null;
    storageMbLimit?: number | null;
    modulesAllowed?: Record<string, boolean>;
    reportingLevel?: string;
    supportLevel?: string;
    isPublic?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.plan.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        description: input.description,
        priceMinor: input.priceMinor,
        currency: (input.currency ?? "KES").toUpperCase().slice(0, 3),
        interval: input.interval ?? "monthly",
        branchLimit: input.branchLimit ?? null,
        userLimit: input.userLimit ?? null,
        deviceLimit: input.deviceLimit ?? null,
        storageMbLimit: input.storageMbLimit ?? null,
        modulesAllowed: input.modulesAllowed ?? { retail: true },
        reportingLevel: input.reportingLevel ?? "standard",
        supportLevel: input.supportLevel ?? "standard",
        isPublic: input.isPublic ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      update: {
        name: input.name,
        description: input.description,
        priceMinor: input.priceMinor,
        currency: input.currency?.toUpperCase().slice(0, 3),
        interval: input.interval,
        branchLimit: input.branchLimit,
        userLimit: input.userLimit,
        deviceLimit: input.deviceLimit,
        storageMbLimit: input.storageMbLimit,
        modulesAllowed: input.modulesAllowed,
        reportingLevel: input.reportingLevel,
        supportLevel: input.supportLevel,
        isPublic: input.isPublic,
        sortOrder: input.sortOrder,
      },
    });
  }

  async assignSubscription(
    tenantId: string,
    planCode: string,
    actorUserId: string,
    opts?: { activate?: boolean },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException({ code: "PLAN_NOT_FOUND", message: "Plan not found" });
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "TENANT_NOT_FOUND", message: "Tenant not found" });

    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const status = opts?.activate ? "active" : "pending";
    const sub = await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        status,
        currentPeriodStart: opts?.activate ? now : null,
        currentPeriodEnd: opts?.activate ? periodEnd : null,
      },
      update: {
        planId: plan.id,
        status,
        currentPeriodStart: opts?.activate ? now : undefined,
        currentPeriodEnd: opts?.activate ? periodEnd : undefined,
      },
      include: { plan: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "billing.subscription.assign",
        entityType: "subscription",
        entityId: sub.id,
        metadata: { tenantId, planCode, status },
      },
    });
    return sub;
  }

  async setSubscriptionStatus(
    tenantId: string,
    status: string,
    actorUserId: string,
  ) {
    const allowed = ["pending", "active", "past_due", "grace", "suspended", "cancelled", "expired"];
    if (!allowed.includes(status)) {
      throw new BadRequestException({ code: "INVALID_STATUS", message: "Invalid subscription status" });
    }
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException({ code: "SUB_NOT_FOUND", message: "No subscription" });
    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status,
        cancelledAt: status === "cancelled" ? new Date() : sub.cancelledAt,
        graceEndsAt:
          status === "grace"
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : sub.graceEndsAt,
      },
      include: { plan: true },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "billing.subscription.status",
        entityType: "subscription",
        entityId: updated.id,
        metadata: { from: sub.status, to: status },
      },
    });
    return updated;
  }

  async createInvoice(tenantId: string, actorUserId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException({ code: "SUB_NOT_FOUND", message: "No subscription" });
    const count = await this.prisma.subscriptionInvoice.count({ where: { tenantId } });
    const number = `INV-${sub.plan.code.toUpperCase()}-${String(count + 1).padStart(5, "0")}`;
    const invoice = await this.prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: sub.id,
        tenantId,
        number,
        status: "open",
        amountMinor: sub.plan.priceMinor,
        currency: sub.plan.currency,
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "billing.invoice.create",
        entityType: "subscription_invoice",
        entityId: invoice.id,
        metadata: { number, amountMinor: invoice.amountMinor },
      },
    });
    return invoice;
  }

  /**
   * Manual payment recording with audit. Does NOT invent gateway success.
   * Confirming sets payment+invoice paid and may activate subscription.
   */
  async recordManualPayment(
    invoiceId: string,
    actorUserId: string,
    input: { amountMinor: number; reference?: string; notes?: string; confirm?: boolean },
  ) {
    const invoice = await this.prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException({ code: "INVOICE_NOT_FOUND", message: "Not found" });
    if (invoice.status === "paid") {
      throw new ConflictException({ code: "ALREADY_PAID", message: "Invoice already paid" });
    }
    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        invoiceId,
        tenantId: invoice.tenantId,
        amountMinor: input.amountMinor,
        currency: invoice.currency,
        method: "manual",
        status: input.confirm ? "confirmed" : "pending",
        reference: input.reference,
        notes: input.notes,
        recordedByUserId: actorUserId,
        confirmedAt: input.confirm ? new Date() : null,
      },
    });
    if (input.confirm) {
      await this.prisma.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: { status: "paid", paidAt: new Date() },
      });
      await this.setSubscriptionStatus(invoice.tenantId, "active", actorUserId);
    }
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "billing.payment.manual",
        entityType: "subscription_payment",
        entityId: payment.id,
        metadata: {
          invoiceId,
          confirmed: Boolean(input.confirm),
          amountMinor: input.amountMinor,
        },
      },
    });
    return payment;
  }

  listSubscriptions() {
    return this.prisma.subscription.findMany({
      include: {
        plan: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  entitlementsFor(tenantId: string) {
    return this.entitlements.snapshot(tenantId);
  }

  async seedDefaultPlans() {
    const defaults = [
      {
        code: "starter",
        name: "Starter",
        description: "Single branch retail essentials",
        priceMinor: 499900,
        branchLimit: 1,
        userLimit: 5,
        deviceLimit: 3,
        modulesAllowed: { retail: true },
        sortOrder: 1,
      },
      {
        code: "growth",
        name: "Growth",
        description: "Multi-branch with restaurant & inventory packs",
        priceMinor: 1299900,
        branchLimit: 5,
        userLimit: 25,
        deviceLimit: 15,
        modulesAllowed: { retail: true, restaurant: true, wholesale: true },
        sortOrder: 2,
      },
      {
        code: "enterprise",
        name: "Enterprise",
        description: "Full module suite and priority support",
        priceMinor: 2999900,
        branchLimit: null,
        userLimit: null,
        deviceLimit: null,
        modulesAllowed: {
          retail: true,
          restaurant: true,
          hotel: true,
          pharmacy: true,
          wholesale: true,
          hardware: true,
          services: true,
        },
        supportLevel: "priority",
        reportingLevel: "advanced",
        sortOrder: 3,
      },
    ];
    const out = [];
    for (const d of defaults) {
      out.push(
        await this.upsertPlan({
          ...d,
          modulesAllowed: d.modulesAllowed as Record<string, boolean>,
        }),
      );
    }
    return out;
  }
}
