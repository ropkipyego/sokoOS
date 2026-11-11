import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  PLATFORM_CONFIG_DEFAULTS,
  TENANT_OVERRIDABLE_KEYS,
  isValidBrandingValue,
  mergeConfigLayers,
  type EffectiveConfig,
} from "./tenant-config.defaults";

function scopeKeyFor(
  layer: "tenant" | "branch" | "department" | "device",
  ids: { branchId?: string; departmentId?: string; deviceId?: string },
): string {
  if (layer === "tenant") return "tenant";
  if (layer === "branch") return `branch:${ids.branchId}`;
  if (layer === "department") return `department:${ids.departmentId}`;
  return `device:${ids.deviceId}`;
}

@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEffective(
    tenantId: string,
    opts: { branchId?: string; departmentId?: string; deviceId?: string } = {},
  ): Promise<{ effective: EffectiveConfig; layers: Record<string, Record<string, unknown>> }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "NOT_FOUND", message: "Tenant not found" });

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const tenantLayer: Record<string, unknown> = {
      currency: tenant.currency,
      timezone: tenant.timezone,
      locale: tenant.locale,
      businessTypes: tenant.businessTypes,
      modulesEnabled: tenant.modulesEnabled,
      ...settings,
    };

    const scopeKeys = ["tenant"];
    if (opts.branchId) scopeKeys.push(`branch:${opts.branchId}`);
    if (opts.departmentId) scopeKeys.push(`department:${opts.departmentId}`);
    if (opts.deviceId) scopeKeys.push(`device:${opts.deviceId}`);

    const overrides = await this.prisma.configSetting.findMany({
      where: { tenantId, scopeKey: { in: scopeKeys } },
    });

    const byScope = (scopeKey: string) =>
      Object.fromEntries(
        overrides.filter((o) => o.scopeKey === scopeKey).map((o) => [o.key, o.value as unknown]),
      );

    const layers = {
      platform: { ...PLATFORM_CONFIG_DEFAULTS },
      tenant: { ...tenantLayer, ...byScope("tenant") },
      branch: opts.branchId ? byScope(`branch:${opts.branchId}`) : {},
      department: opts.departmentId ? byScope(`department:${opts.departmentId}`) : {},
      device: opts.deviceId ? byScope(`device:${opts.deviceId}`) : {},
    };

    const effective = mergeConfigLayers([
      { layer: "platform", values: layers.platform },
      { layer: "tenant", values: layers.tenant },
      { layer: "branch", values: layers.branch },
      { layer: "department", values: layers.department },
      { layer: "device", values: layers.device },
    ]);

    return { effective, layers };
  }

  listOverrides(tenantId: string) {
    return this.prisma.configSetting.findMany({
      where: { tenantId },
      orderBy: [{ layer: "asc" }, { key: "asc" }],
    });
  }

  async setOverride(
    tenantId: string,
    userId: string,
    input: {
      layer: "tenant" | "branch" | "department" | "device";
      key: string;
      value: unknown;
      branchId?: string;
      departmentId?: string;
      deviceId?: string;
    },
  ) {
    if (!input.key?.trim()) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "key required" });
    }
    if (input.layer === "tenant" && !TENANT_OVERRIDABLE_KEYS.has(input.key)) {
      throw new BadRequestException({
        code: "KEY_NOT_OVERRIDABLE",
        message: `Key ${input.key} is not tenant-overridable (platform-locked or unknown)`,
      });
    }
    if (!isValidBrandingValue(input.key, input.value)) {
      throw new BadRequestException({
        code: "INVALID_CONFIG_VALUE",
        message: `Invalid value for ${input.key}`,
      });
    }
    if (input.layer === "branch" && !input.branchId) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "branchId required" });
    }
    if (input.layer === "department" && !input.departmentId) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "departmentId required" });
    }
    if (input.layer === "device" && !input.deviceId) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "deviceId required" });
    }

    const scopeKey = scopeKeyFor(input.layer, input);
    const branchId = input.layer === "branch" ? input.branchId! : null;
    const departmentId = input.layer === "department" ? input.departmentId! : null;
    const deviceId = input.layer === "device" ? input.deviceId! : null;

    const row = await this.prisma.configSetting.upsert({
      where: {
        tenantId_scopeKey_key: {
          tenantId,
          scopeKey,
          key: input.key,
        },
      },
      create: {
        tenantId,
        layer: input.layer,
        scopeKey,
        branchId,
        departmentId,
        deviceId,
        key: input.key,
        value: input.value as object,
        updatedBy: userId,
      },
      update: {
        value: input.value as object,
        updatedBy: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        action: "config.override.set",
        entityType: "config_setting",
        entityId: row.id,
        metadata: {
          layer: input.layer,
          key: input.key,
          note: "Does not rewrite historical transactions",
        },
      },
    });

    return row;
  }

  async deleteOverride(tenantId: string, id: string, userId: string) {
    const row = await this.prisma.configSetting.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Override not found" });
    await this.prisma.configSetting.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        action: "config.override.delete",
        entityType: "config_setting",
        entityId: id,
        metadata: { key: row.key, layer: row.layer },
      },
    });
    return { ok: true };
  }
}
