import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Tenant not found" });
    }
    return tenant;
  }

  async updateCurrent(
    tenantId: string,
    input: {
      name?: string;
      timezone?: string;
      locale?: string;
      currency?: string;
      taxConfig?: object;
      settings?: object;
    },
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: input.name,
        timezone: input.timezone,
        locale: input.locale,
        currency: input.currency,
        taxConfig: input.taxConfig,
        settings: input.settings,
      },
    });
  }

  async listPlatform() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  }

  async createPlatform(input: {
    name: string;
    slug: string;
    currency: string;
    timezone: string;
    locale: string;
  }) {
    const tenant = await this.prisma.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        currency: input.currency,
        timezone: input.timezone,
        locale: input.locale,
      },
    });
    await this.prisma.authzVersion.create({
      data: { tenantId: tenant.id, version: 1 },
    });
    return tenant;
  }

  getNegativeStockPolicy(tenant: { settings: unknown }): "allow" | "warn" | "block" {
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const policy = settings.negativeStockPolicy;
    if (policy === "allow" || policy === "warn" || policy === "block") {
      return policy;
    }
    return "block";
  }
}
