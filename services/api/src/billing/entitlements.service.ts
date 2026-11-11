import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type EntitlementSnapshot = {
  tenantId: string;
  subscriptionStatus: string | null;
  planCode: string | null;
  planName: string | null;
  /** write | read_only | blocked_nonessential */
  accessMode: "write" | "read_only" | "blocked_nonessential";
  modulesAllowed: Record<string, boolean>;
  limits: {
    branchLimit: number | null;
    userLimit: number | null;
    deviceLimit: number | null;
    storageMbLimit: number | null;
  };
  reason?: string;
};

/**
 * Central entitlement gate. Controllers/services must use this — not ad-hoc plan checks in UI.
 * Suspension never deletes data; security/export paths remain available.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(tenantId: string): Promise<EntitlementSnapshot> {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!sub) {
      // Legacy tenants without a subscription keep write access until commercially migrated
      return {
        tenantId,
        subscriptionStatus: null,
        planCode: null,
        planName: null,
        accessMode: "write",
        modulesAllowed: {},
        limits: {
          branchLimit: null,
          userLimit: null,
          deviceLimit: null,
          storageMbLimit: null,
        },
        reason: "no_subscription_legacy_write",
      };
    }

    const modulesAllowed = (sub.plan.modulesAllowed ?? {}) as Record<string, boolean>;
    const limits = {
      branchLimit: sub.plan.branchLimit,
      userLimit: sub.plan.userLimit,
      deviceLimit: sub.plan.deviceLimit,
      storageMbLimit: sub.plan.storageMbLimit,
    };

    if (sub.status === "active") {
      return {
        tenantId,
        subscriptionStatus: sub.status,
        planCode: sub.plan.code,
        planName: sub.plan.name,
        accessMode: "write",
        modulesAllowed,
        limits,
      };
    }
    if (sub.status === "grace" || sub.status === "past_due") {
      return {
        tenantId,
        subscriptionStatus: sub.status,
        planCode: sub.plan.code,
        planName: sub.plan.name,
        accessMode: "read_only",
        modulesAllowed,
        limits,
        reason: "subscription_grace_or_past_due",
      };
    }
    if (sub.status === "suspended" || sub.status === "cancelled" || sub.status === "expired") {
      return {
        tenantId,
        subscriptionStatus: sub.status,
        planCode: sub.plan.code,
        planName: sub.plan.name,
        accessMode: "blocked_nonessential",
        modulesAllowed,
        limits,
        reason: "subscription_inactive",
      };
    }
    return {
      tenantId,
      subscriptionStatus: sub.status,
      planCode: sub.plan.code,
      planName: sub.plan.name,
      accessMode: "read_only",
      modulesAllowed,
      limits,
      reason: "subscription_pending",
    };
  }

  /** Enforce write access for mutating business operations. */
  async assertWrite(tenantId: string) {
    const snap = await this.snapshot(tenantId);
    if (snap.accessMode !== "write") {
      throw new ForbiddenException({
        code: "ENTITLEMENT_READ_ONLY",
        message: "Subscription does not allow write operations",
        details: [{ message: snap.reason ?? snap.subscriptionStatus ?? "restricted" }],
      });
    }
    return snap;
  }

  async assertModule(tenantId: string, moduleKey: string) {
    const snap = await this.snapshot(tenantId);
    if (Object.keys(snap.modulesAllowed).length === 0) return snap; // legacy open
    if (snap.modulesAllowed[moduleKey] === false) {
      throw new ForbiddenException({
        code: "MODULE_NOT_ENTITLED",
        message: `Module ${moduleKey} is not included in the current plan`,
      });
    }
    return snap;
  }
}
