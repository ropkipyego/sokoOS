import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_SETTINGS: Record<string, unknown> = {
  "announcement.banner": "",
  "announcement.enabled": false,
  "support.defaultPriority": "normal",
  "onboarding.requireEmailVerify": true,
  "billing.graceDays": 7,
  "security.sessionNote": "JWT access short-lived; refresh rotated",
};

@Injectable()
export class PlatformConsoleService {
  constructor(private readonly prisma: PrismaService) {}

  async richOverview() {
    const [
      businesses,
      active,
      suspended,
      invitationPending,
      provisioningFailed,
      awaitingApproval,
      branches,
      tenantUsers,
      platformUsers,
      devices,
      openTickets,
      emailFailed,
      emailQueued,
      subscriptionsActive,
      domainsPending,
      recentTenants,
      recentAudit,
      recentRegs,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: "active" } }),
      this.prisma.tenant.count({ where: { status: "suspended" } }),
      this.prisma.tenant.count({ where: { status: "invitation_pending" } }),
      this.prisma.tenant.count({ where: { status: "provisioning_failed" } }),
      this.prisma.registrationRequest.count({
        where: { status: { in: ["awaiting_approval", "registration_pending"] } },
      }),
      this.prisma.branch.count(),
      this.prisma.user.count({ where: { tenantId: { not: null } } }),
      this.prisma.user.count({ where: { tenantId: null } }),
      this.prisma.device.count(),
      this.prisma.supportTicket.count({ where: { status: { in: ["open", "pending"] } } }),
      this.prisma.emailMessage.count({ where: { status: "failed" } }),
      this.prisma.emailMessage.count({ where: { status: { in: ["queued", "retried"] } } }),
      this.prisma.subscription.count({ where: { status: "active" } }),
      this.prisma.tenantDomain.count({ where: { status: "pending" } }),
      this.prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, slug: true, status: true, createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { tenantId: null },
            { action: { startsWith: "platform." } },
            { action: { startsWith: "billing." } },
            { action: { startsWith: "registration." } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          tenantId: true,
          createdAt: true,
          actorUserId: true,
        },
      }),
      this.prisma.registrationRequest.findMany({
        where: { status: { in: ["awaiting_approval", "registration_pending", "info_requested"] } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          businessName: true,
          preferredSlug: true,
          status: true,
          email: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totals: {
        businesses,
        active,
        suspended,
        invitationPending,
        provisioningFailed,
        awaitingApproval,
        branches,
        tenantUsers,
        platformUsers,
        devices,
        openTickets,
        emailFailed,
        emailQueued,
        subscriptionsActive,
        domainsPending,
      },
      attention: {
        awaitingApproval,
        invitationPending,
        provisioningFailed,
        openTickets,
        emailFailed,
        domainsPending,
      },
      recentlyOnboarded: recentTenants,
      pendingRegistrations: recentRegs,
      recentAudit,
    };
  }

  async listPlatformUsers() {
    const users = await this.prisma.user.findMany({
      where: { tenantId: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: { select: { key: true, name: true } },
          },
        },
      },
      take: 200,
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      phone: u.phone,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ur.role.key),
    }));
  }

  async listTenantUsers(q?: string) {
    const needle = q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: { not: null },
        ...(needle
          ? {
              OR: [
                { email: { contains: needle, mode: "insensitive" } },
                { name: { contains: needle, mode: "insensitive" } },
                { tenant: { slug: { contains: needle, mode: "insensitive" } } },
                { tenant: { name: { contains: needle, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        tenantId: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, slug: true, status: true } },
        userRoles: { include: { role: { select: { key: true } } }, take: 5 },
      },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      tenantId: u.tenantId,
      tenantName: u.tenant?.name,
      tenantSlug: u.tenant?.slug,
      tenantStatus: u.tenant?.status,
      roles: u.userRoles.map((r) => r.role.key),
      createdAt: u.createdAt,
    }));
  }

  async setPlatformUserStatus(userId: string, status: string, actorUserId: string) {
    if (!["active", "disabled", "invited"].includes(status)) {
      throw new BadRequestException({ code: "INVALID_STATUS", message: "Invalid user status" });
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId: null } });
    if (!user) throw new NotFoundException({ code: "NOT_FOUND", message: "Platform user not found" });
    if (user.id === actorUserId && status !== "active") {
      throw new BadRequestException({
        code: "SELF_DISABLE",
        message: "Cannot disable your own platform account",
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "platform.user.status",
        entityType: "user",
        entityId: userId,
        metadata: { from: user.status, to: status },
      },
    });
    return updated;
  }

  async listDevices(q?: string) {
    const needle = q?.trim();
    return this.prisma.device.findMany({
      where: needle
        ? {
            OR: [
              { name: { contains: needle, mode: "insensitive" } },
              { tenant: { slug: { contains: needle, mode: "insensitive" } } },
              { tenant: { name: { contains: needle, mode: "insensitive" } } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        status: true,
        branchId: true,
        tenantId: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { name: true, slug: true, status: true } },
        branch: { select: { name: true, code: true } },
      },
    });
  }

  async listAudit(opts?: { q?: string; limit?: number }) {
    const limit = Math.min(opts?.limit ?? 100, 300);
    const needle = opts?.q?.trim();
    return this.prisma.auditLog.findMany({
      where: needle
        ? {
            OR: [
              { action: { contains: needle, mode: "insensitive" } },
              { entityType: { contains: needle, mode: "insensitive" } },
              { entityId: { contains: needle, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        tenant: { select: { slug: true, name: true } },
        actor: { select: { email: true, name: true } },
      },
    });
  }

  async listEntitlementsMatrix() {
    const subs = await this.prisma.subscription.findMany({
      include: {
        plan: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        modulesEnabled: true,
      },
    });
    const byId = new Map(tenants.map((t) => [t.id, t]));
    return subs.map((s) => {
      const t = byId.get(s.tenantId);
      return {
        tenantId: s.tenantId,
        tenantName: t?.name,
        tenantSlug: t?.slug,
        tenantStatus: t?.status,
        subscriptionStatus: s.status,
        planCode: s.plan.code,
        planName: s.plan.name,
        planModules: s.plan.modulesAllowed,
        tenantModules: t?.modulesEnabled,
        periodEnd: s.currentPeriodEnd,
      };
    });
  }

  async integrationsSafety() {
    // Real counts only — no invented provider confirmations
    const [pendingPayments, failedEmail, openSupport, unverifiedDomains] = await Promise.all([
      this.prisma.salePayment.count({ where: { status: "pending" } }).catch(() => 0),
      this.prisma.emailMessage.count({ where: { status: "failed" } }),
      this.prisma.supportTicket.count({ where: { status: { in: ["open", "pending"] } } }),
      this.prisma.tenantDomain.count({
        where: { kind: "custom", status: { in: ["pending", "verified"] } },
      }),
    ]);
    return {
      providers: [
        {
          key: "email",
          status: process.env.MAIL_PROVIDER === "smtp" ? "configured" : "dev_adapter",
          note: "Delivery evidence required for delivered status",
        },
        {
          key: "mpesa",
          status: process.env.MPESA_CONSUMER_KEY ? "credentials_present" : "not_configured",
          note: "STK creates pending only until verified callback",
        },
        {
          key: "payment_gateway",
          status: "not_configured",
          note: "Live recurring billing disabled until adapter + reconciliation exist",
        },
        {
          key: "dns_tls",
          status: "manual",
          note: "Custom domain TLS never marked provisioned without evidence",
        },
      ],
      queues: {
        pendingPayments,
        failedEmail,
        openSupport,
        unverifiedDomains,
      },
    };
  }

  async getSettings() {
    const rows = await this.prisma.platformSetting.findMany();
    const map: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return {
      settings: map,
      meta: rows.map((r) => ({ key: r.key, updatedAt: r.updatedAt, updatedBy: r.updatedBy })),
    };
  }

  async setSetting(key: string, value: unknown, actorUserId: string) {
    if (!key?.trim()) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "key required" });
    }
    // Never allow secret-looking keys
    if (/secret|password|token|key|credential/i.test(key) && !key.startsWith("announcement.")) {
      throw new BadRequestException({
        code: "FORBIDDEN_KEY",
        message: "Secrets cannot be stored in platform settings UI",
      });
    }
    const row = await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: value as object, updatedBy: actorUserId },
      update: { value: value as object, updatedBy: actorUserId },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "platform.settings.set",
        entityType: "platform_setting",
        entityId: key,
        metadata: { key },
      },
    });
    return row;
  }
}
