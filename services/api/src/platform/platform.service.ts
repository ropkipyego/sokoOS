import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import {
  BUSINESS_TYPES,
  defaultModulesForTypes,
  type BusinessType,
  type ModulesEnabled,
} from "@sokoos/types";
import { SystemRole } from "@sokoos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService, ROLE_PERMISSION_TEMPLATES } from "../roles/roles.service";
import { CORE_PERMISSION_KEYS } from "@sokoos/types";

export type OnboardingPayload = {
  business?: {
    name?: string;
    legalName?: string;
    slug?: string;
    email?: string;
    phone?: string;
    address?: string;
    country?: string;
    currency?: string;
    timezone?: string;
    locale?: string;
  };
  profile?: {
    businessTypes?: BusinessType[];
    modulesEnabled?: ModulesEnabled;
  };
  branch?: {
    name?: string;
    code?: string;
    address?: string;
    phone?: string;
  };
  departments?: Array<{ code: string; name: string; type: string }>;
  admin?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  operational?: {
    negativeStockPolicy?: string;
    receiptFooter?: string;
  };
  devices?: Array<{ name: string }>;
};

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
  ) {}

  async overview() {
    const [tenants, active, suspended, branches, users, devices, recent] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: "active" } }),
      this.prisma.tenant.count({ where: { status: "suspended" } }),
      this.prisma.branch.count(),
      this.prisma.user.count({ where: { tenantId: { not: null } } }),
      this.prisma.device.count(),
      this.prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          businessTypes: true,
          modulesEnabled: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      totals: {
        businesses: tenants,
        active,
        suspended,
        branches,
        users,
        devices,
      },
      recentlyOnboarded: recent,
    };
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { branches: true, users: true, devices: true, departments: true } },
      },
    });
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branches: true,
        departments: true,
        users: { select: { id: true, email: true, name: true, status: true, createdAt: true } },
        devices: { select: { id: true, name: true, status: true, branchId: true } },
        _count: { select: { sales: true, products: true } },
      },
    });
    if (!tenant) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Tenant not found" });
    }
    return tenant;
  }

  async setTenantStatus(tenantId: string, status: "active" | "suspended", actorUserId: string) {
    if (status !== "active" && status !== "suspended") {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Invalid status" });
    }
    const tenant = await this.getTenant(tenantId);
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId: actorUserId,
        action: status === "suspended" ? "platform.tenant.suspend" : "platform.tenant.activate",
        entityType: "tenant",
        entityId: tenantId,
        metadata: { status, previous: tenant.status },
      },
    });
    return updated;
  }

  async updateTenantModules(
    tenantId: string,
    input: { businessTypes?: BusinessType[]; modulesEnabled?: ModulesEnabled },
    actorUserId: string,
  ) {
    await this.getTenant(tenantId);
    const data: Record<string, unknown> = {};
    if (input.businessTypes) {
      for (const t of input.businessTypes) {
        if (!(BUSINESS_TYPES as readonly string[]).includes(t)) {
          throw new BadRequestException({ code: "VALIDATION_FAILED", message: `Invalid type ${t}` });
        }
      }
      data.businessTypes = input.businessTypes;
      if (!input.modulesEnabled) {
        data.modulesEnabled = defaultModulesForTypes(input.businessTypes);
      }
    }
    if (input.modulesEnabled) data.modulesEnabled = input.modulesEnabled;
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: data as never,
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "platform.tenant.modules",
        entityType: "tenant",
        entityId: tenantId,
        metadata: data as object,
      },
    });
    return updated;
  }

  async listDrafts(userId: string) {
    return this.prisma.onboardingDraft.findMany({
      where: { createdByUserId: userId, status: "draft" },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createDraft(userId: string) {
    return this.prisma.onboardingDraft.create({
      data: {
        createdByUserId: userId,
        step: 1,
        status: "draft",
        payload: {},
      },
    });
  }

  async getDraft(id: string, userId: string) {
    const draft = await this.prisma.onboardingDraft.findFirst({
      where: { id, createdByUserId: userId },
    });
    if (!draft) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Draft not found" });
    }
    return draft;
  }

  async saveDraft(id: string, userId: string, step: number, payloadPatch: OnboardingPayload) {
    const draft = await this.getDraft(id, userId);
    if (draft.status !== "draft") {
      throw new ConflictException({ code: "CONFLICT", message: "Draft is not editable" });
    }
    const prev = (draft.payload ?? {}) as OnboardingPayload;
    const payload: OnboardingPayload = {
      ...prev,
      ...payloadPatch,
      business: { ...(prev.business ?? {}), ...(payloadPatch.business ?? {}) },
      profile: { ...(prev.profile ?? {}), ...(payloadPatch.profile ?? {}) },
      branch: { ...(prev.branch ?? {}), ...(payloadPatch.branch ?? {}) },
      admin: { ...(prev.admin ?? {}), ...(payloadPatch.admin ?? {}) },
      operational: { ...(prev.operational ?? {}), ...(payloadPatch.operational ?? {}) },
      departments: payloadPatch.departments ?? prev.departments,
      devices: payloadPatch.devices ?? prev.devices,
    };
    return this.prisma.onboardingDraft.update({
      where: { id },
      data: { step, payload },
    });
  }

  /**
   * Activate onboarding: create tenant + branch + warehouse + admin + roles + departments in one transaction.
   * Returns invite token once (never logged).
   */
  async activateDraft(id: string, userId: string) {
    const draft = await this.getDraft(id, userId);
    if (draft.status !== "draft") {
      throw new ConflictException({ code: "CONFLICT", message: "Draft already completed" });
    }
    const p = (draft.payload ?? {}) as OnboardingPayload;
    const name = p.business?.name?.trim();
    const slug = p.business?.slug?.trim().toLowerCase();
    const adminEmail = p.admin?.email?.trim().toLowerCase();
    const adminName = p.admin?.name?.trim();
    if (!name || !slug || !adminEmail || !adminName) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Business name, slug, and administrator name/email are required",
      });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Invalid slug format" });
    }
    const { isReservedSlug } = await import("../domains/reserved-hosts");
    if (isReservedSlug(slug)) {
      throw new BadRequestException({
        code: "RESERVED_SLUG",
        message: "This business slug is reserved by the platform",
      });
    }

    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException({ code: "CONFLICT", message: "Business slug already registered" });
    }

    const types = (p.profile?.businessTypes?.length
      ? p.profile.businessTypes
      : ["retail"]) as BusinessType[];
    const modules = p.profile?.modulesEnabled ?? defaultModulesForTypes(types);
    const currency = (p.business?.currency ?? "KES").toUpperCase().slice(0, 3);
    const timezone = p.business?.timezone ?? "Africa/Nairobi";
    const locale = p.business?.locale ?? "en-KE";

    const inviteRaw = randomBytes(32).toString("hex");
    const inviteHash = createHash("sha256").update(inviteRaw).digest("hex");
    // Unusable random password until activation/reset
    const passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          legalName: p.business?.legalName ?? name,
          email: p.business?.email ?? adminEmail,
          phone: p.business?.phone,
          currency,
          timezone,
          locale,
          status: "active",
          onboardingStatus: "complete",
          businessTypes: types,
          modulesEnabled: modules,
          settings: {
            negativeStockPolicy: p.operational?.negativeStockPolicy ?? "block",
            company: {
              legalName: p.business?.legalName ?? name,
              email: p.business?.email ?? adminEmail,
              phone: p.business?.phone,
              address: p.business?.address,
              country: p.business?.country,
            },
            receipts: { footer: p.operational?.receiptFooter ?? "Thank you" },
            businessMode: modules.hotel || modules.restaurant ? "hybrid" : "retail",
            restaurantEnabled: Boolean(modules.restaurant),
            inviteActivationHash: inviteHash,
          },
        },
      });

      await tx.authzVersion.create({ data: { tenantId: tenant.id, version: 1 } });

      const baseDomain = process.env.SOKOOS_BASE_DOMAIN ?? "sokoos.com";
      await tx.tenantDomain.create({
        data: {
          tenantId: tenant.id,
          hostname: `${slug}.${baseDomain}`.toLowerCase(),
          kind: "subdomain",
          status: "active",
          isPrimary: true,
          verifiedAt: new Date(),
          tlsStatus: "unknown",
        },
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: p.branch?.name ?? "Main",
          code: (p.branch?.code ?? "MAIN").toUpperCase(),
          status: "active",
          address: p.branch?.address ? { line1: p.branch.address } : undefined,
        },
      });

      await tx.warehouse.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          name: "Main Store",
          isDefault: true,
          status: "active",
        },
      });

      // Ensure permissions exist
      for (const key of CORE_PERMISSION_KEYS) {
        await tx.permission.upsert({
          where: { key },
          create: { key, description: key, category: key.split(".")[0] ?? "core" },
          update: {},
        });
      }

      const ownerPerms =
        ROLE_PERMISSION_TEMPLATES[SystemRole.BusinessOwner] ??
        CORE_PERMISSION_KEYS.filter((k) => !k.startsWith("platform."));
      let ownerRole = await tx.role.findFirst({
        where: { tenantId: tenant.id, key: SystemRole.BusinessOwner },
      });
      if (!ownerRole) {
        ownerRole = await tx.role.create({
          data: {
            tenantId: tenant.id,
            key: SystemRole.BusinessOwner,
            name: "Business Owner",
            isSystem: true,
          },
        });
      }
      const perms = await tx.permission.findMany({ where: { key: { in: [...ownerPerms] } } });
      for (const perm of perms) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: perm.id } },
          create: { roleId: ownerRole.id, permissionId: perm.id },
          update: {},
        });
      }

      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          name: adminName,
          phone: p.admin?.phone,
          passwordHash,
          status: "invited",
        },
      });

      await tx.userRole.create({
        data: {
          tenantId: tenant.id,
          userId: admin.id,
          roleId: ownerRole.id,
          branchId: null,
        },
      });

      const deptInputs = p.departments?.length
        ? p.departments
        : [{ code: "OPS", name: "Operations", type: "retail" }];
      for (const [i, d] of deptInputs.entries()) {
        await tx.department.create({
          data: {
            tenantId: tenant.id,
            branchId: branch.id,
            code: d.code.toUpperCase(),
            name: d.name,
            type: d.type || "retail",
            sortOrder: i,
            status: "active",
            createdBy: userId,
          },
        });
      }

      for (const [i, dev] of (p.devices ?? []).entries()) {
        await tx.device.create({
          data: {
            tenantId: tenant.id,
            branchId: branch.id,
            name: dev.name || `Terminal ${i + 1}`,
            status: "active",
          },
        });
      }

      await tx.onboardingDraft.update({
        where: { id: draft.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          resultingTenantId: tenant.id,
          step: 8,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: null,
          actorUserId: userId,
          action: "platform.onboarding.activate",
          entityType: "tenant",
          entityId: tenant.id,
          metadata: { slug, adminEmail },
        },
      });

      return { tenant, branch, adminId: admin.id };
    });

    return {
      tenant: result.tenant,
      branchId: result.branch.id,
      adminUserId: result.adminId,
      // Shown once to platform operator — not stored plaintext
      activationToken: inviteRaw,
      activationHint: "Admin must set password via /v1/auth/activate with this token (Phase 1 stores hash on tenant settings).",
    };
  }

  assertPlatformActor(user: { tenantId: string | null; permissions: string[] }) {
    const ok = user.permissions.some((p) => p.startsWith("platform."));
    if (!ok) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Platform permission required" });
    }
  }
}
