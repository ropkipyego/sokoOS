import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import {
  CORE_PERMISSION_KEYS,
  defaultModulesForTypes,
  type BusinessType,
  type ModulesEnabled,
} from "@sokoos/types";
import { SystemRole } from "@sokoos/shared";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_PERMISSION_TEMPLATES } from "../roles/roles.service";
import { isReservedSlug } from "../domains/reserved-hosts";
import { EmailService } from "../email/email.service";

export type ProvisionInput = {
  /** Stable key for safe retries */
  idempotencyKey: string;
  businessName: string;
  legalName?: string;
  slug: string;
  email?: string;
  phone?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  locale?: string;
  businessTypes?: BusinessType[];
  modulesEnabled?: ModulesEnabled;
  branchName?: string;
  branchCode?: string;
  departments?: Array<{ code: string; name: string; type: string }>;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  actorUserId?: string;
  registrationRequestId?: string;
  /** invitation_pending until admin activates (default) */
  initialStatus?: "invitation_pending" | "active";
};

export type ProvisionResult = {
  tenantId: string;
  slug: string;
  branchId: string;
  adminUserId: string;
  domainHostname: string;
  /** Raw invite token — return once; never log */
  activationToken: string;
  reused: boolean;
};

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    const slug = input.slug.trim().toLowerCase();
    const adminEmail = input.adminEmail.trim().toLowerCase();
    const adminName = input.adminName.trim();
    const name = input.businessName.trim();

    if (!name || !slug || !adminEmail || !adminName) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Business name, slug, and administrator name/email are required",
      });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || isReservedSlug(slug)) {
      throw new BadRequestException({
        code: "INVALID_OR_RESERVED_SLUG",
        message: "Slug is invalid or reserved",
      });
    }

    // Idempotent reuse: prior successful provision with same key
    const prior = await this.prisma.tenant.findFirst({
      where: {
        settings: {
          path: ["provisioning", "idempotencyKey"],
          equals: input.idempotencyKey,
        },
      },
      include: {
        branches: { take: 1, orderBy: { createdAt: "asc" } },
        users: { where: { email: adminEmail }, take: 1 },
        domains: { where: { isPrimary: true }, take: 1 },
      },
    });
    if (prior) {
      const settings = prior.settings as Record<string, unknown>;
      const prov = (settings.provisioning ?? {}) as { activationTokenHash?: string };
      return {
        tenantId: prior.id,
        slug: prior.slug,
        branchId: prior.branches[0]?.id ?? "",
        adminUserId: prior.users[0]?.id ?? "",
        domainHostname: prior.domains[0]?.hostname ?? `${slug}.${process.env.SOKOOS_BASE_DOMAIN ?? "sokoos.com"}`,
        activationToken: "", // not re-issued on retry — use resend invitation (SaaS-03)
        reused: true,
        // expose hash presence only via reused flag
        ...(prov.activationTokenHash ? {} : {}),
      };
    }

    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException({
        code: "SLUG_TAKEN",
        message: "Business slug already registered",
      });
    }

    const types = (input.businessTypes?.length ? input.businessTypes : ["retail"]) as BusinessType[];
    const modules = input.modulesEnabled ?? defaultModulesForTypes(types);
    const currency = (input.currency ?? "KES").toUpperCase().slice(0, 3);
    const timezone = input.timezone ?? "Africa/Nairobi";
    const locale = input.locale ?? "en-KE";
    const baseDomain = process.env.SOKOOS_BASE_DOMAIN ?? "sokoos.com";
    const hostname = `${slug}.${baseDomain}`.toLowerCase();

    const hostTaken = await this.prisma.tenantDomain.findUnique({ where: { hostname } });
    if (hostTaken) {
      throw new ConflictException({
        code: "DOMAIN_COLLISION",
        message: "Managed subdomain already mapped",
      });
    }

    const inviteRaw = randomBytes(32).toString("hex");
    const inviteHash = createHash("sha256").update(inviteRaw).digest("hex");
    const passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
    const initialStatus = input.initialStatus ?? "invitation_pending";

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name,
            slug,
            legalName: input.legalName ?? name,
            email: input.email ?? adminEmail,
            phone: input.phone,
            currency,
            timezone,
            locale,
            status: initialStatus,
            onboardingStatus: "complete",
            businessTypes: types,
            modulesEnabled: modules,
            settings: {
              negativeStockPolicy: "block",
              company: {
                legalName: input.legalName ?? name,
                email: input.email ?? adminEmail,
                phone: input.phone,
                country: input.country ?? "KE",
              },
              receipts: { footer: "Thank you" },
              inviteActivationHash: inviteHash,
              provisioning: {
                idempotencyKey: input.idempotencyKey,
                activationTokenHash: inviteHash,
                completedAt: new Date().toISOString(),
                registrationRequestId: input.registrationRequestId ?? null,
              },
            },
          },
        });

        await tx.authzVersion.create({ data: { tenantId: tenant.id, version: 1 } });

        await tx.tenantDomain.create({
          data: {
            tenantId: tenant.id,
            hostname,
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
            name: input.branchName ?? "Main",
            code: (input.branchCode ?? "MAIN").toUpperCase(),
            status: "active",
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
            where: { roleId_permissionId: { roleId: ownerRole!.id, permissionId: perm.id } },
            create: { roleId: ownerRole!.id, permissionId: perm.id },
            update: {},
          });
        }

        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: adminEmail,
            name: adminName,
            phone: input.adminPhone,
            passwordHash,
            status: "invited",
          },
        });

        await tx.userRole.create({
          data: {
            tenantId: tenant.id,
            userId: admin.id,
            roleId: ownerRole!.id,
            branchId: null,
          },
        });

        const deptInputs = input.departments?.length
          ? input.departments
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
              createdBy: input.actorUserId,
            },
          });
        }

        await tx.tenantInvitation.create({
          data: {
            tenantId: tenant.id,
            email: adminEmail,
            name: adminName,
            roleKey: SystemRole.BusinessOwner,
            status: "pending",
            tokenHash: inviteHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invitedByUserId: input.actorUserId ?? null,
          },
        });

        if (input.registrationRequestId) {
          await tx.registrationRequest.update({
            where: { id: input.registrationRequestId },
            data: {
              status: "provisioned",
              resultingTenantId: tenant.id,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            tenantId: null,
            actorUserId: input.actorUserId ?? null,
            action: "platform.tenant.provision",
            entityType: "tenant",
            entityId: tenant.id,
            metadata: {
              slug,
              adminEmail,
              idempotencyKey: input.idempotencyKey,
              registrationRequestId: input.registrationRequestId ?? null,
            },
          },
        });

        return { tenant, branch, adminId: admin.id };
      });

      const appBase = (
        this.config.get<string>("SOKOOS_PUBLIC_APP_URL") ??
        this.config.get<string>("API_PUBLIC_URL") ??
        "http://localhost:5175"
      ).replace(/\/$/, "");
      const activateUrl = `${appBase}/activate?token=${inviteRaw}`;
      const mail = await this.email.enqueue({
        templateKey: "admin.invitation",
        toEmail: adminEmail,
        toName: adminName,
        tenantId: result.tenant.id,
        idempotencyKey: `admin.invitation:${result.tenant.id}`,
        context: {
          adminName,
          businessName: name,
          activateUrl,
          hostname,
        },
      });
      await this.email.processOne(mail.id);

      return {
        tenantId: result.tenant.id,
        slug: result.tenant.slug,
        branchId: result.branch.id,
        adminUserId: result.adminId,
        domainHostname: hostname,
        activationToken: inviteRaw,
        reused: false,
      };
    } catch (err) {
      // Observable failure path for callers that set provisioning status first
      if (input.registrationRequestId) {
        await this.prisma.registrationRequest
          .update({
            where: { id: input.registrationRequestId },
            data: {
              status: "awaiting_approval",
              reviewNotes: `Provisioning failed: ${err instanceof Error ? err.message : "unknown"}`,
            },
          })
          .catch(() => undefined);
      }
      throw err;
    }
  }

  async retryFailedTenant(tenantId: string, actorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "TENANT_NOT_FOUND", message: "Not found" });
    if (tenant.status !== "provisioning_failed") {
      throw new BadRequestException({
        code: "NOT_FAILED",
        message: "Tenant is not in provisioning_failed state",
      });
    }
    const settings = tenant.settings as Record<string, unknown>;
    const key =
      ((settings.provisioning as { idempotencyKey?: string } | undefined)?.idempotencyKey) ??
      `retry-${tenantId}`;
    // Mark active-bound invitation path: ensure domain + warehouse exist
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { tenantId, isPrimary: true },
    });
    if (!domain) {
      const hostname = `${tenant.slug}.${process.env.SOKOOS_BASE_DOMAIN ?? "sokoos.com"}`;
      await this.prisma.tenantDomain.create({
        data: {
          tenantId,
          hostname,
          kind: "subdomain",
          status: "active",
          isPrimary: true,
          verifiedAt: new Date(),
        },
      });
    }
    const branch = await this.prisma.branch.findFirst({ where: { tenantId } });
    if (branch) {
      const wh = await this.prisma.warehouse.findFirst({ where: { tenantId, branchId: branch.id } });
      if (!wh) {
        await this.prisma.warehouse.create({
          data: {
            tenantId,
            branchId: branch.id,
            name: "Main Store",
            isDefault: true,
            status: "active",
          },
        });
      }
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: "invitation_pending",
        settings: {
          ...settings,
          provisioning: {
            ...((settings.provisioning as object) ?? {}),
            idempotencyKey: key,
            recoveredAt: new Date().toISOString(),
            recoveredBy: actorUserId,
          },
        },
      },
    });
    return { tenantId, status: "invitation_pending" };
  }
}
