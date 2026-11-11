import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  classifyHostShape,
  isReservedSlug,
  normalizeHostname,
  RESERVED_SLUGS,
} from "./reserved-hosts";

export type ResolveOutcome =
  | {
      outcome: "public" | "platform" | "unknown" | "invalid_host";
      hostname: string;
      message: string;
    }
  | {
      outcome: "tenant" | "inactive" | "suspended" | "unverified_custom" | "removed";
      hostname: string;
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      tenantStatus: string;
      domainId: string;
      domainKind: string;
      domainStatus: string;
      isPrimary: boolean;
      message: string;
    };

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  baseDomain(): string {
    return (this.config.get<string>("SOKOOS_BASE_DOMAIN") ?? "sokoos.com").toLowerCase();
  }

  platformHost(): string {
    return (
      this.config.get<string>("SOKOOS_PLATFORM_HOST") ?? `platform.${this.baseDomain()}`
    ).toLowerCase();
  }

  publicHosts(): string[] {
    const raw = this.config.get<string>("SOKOOS_PUBLIC_HOSTS") ?? "";
    const extras = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return [this.baseDomain(), `www.${this.baseDomain()}`, ...extras];
  }

  managedHostnameForSlug(slug: string): string {
    return `${slug}.${this.baseDomain()}`;
  }

  async resolveHost(rawHost: string | undefined | null): Promise<ResolveOutcome> {
    if (!rawHost || !String(rawHost).trim()) {
      return {
        outcome: "invalid_host",
        hostname: "",
        message: "Missing Host header",
      };
    }
    const hostname = normalizeHostname(rawHost);
    if (!hostname) {
      return { outcome: "invalid_host", hostname: "", message: "Invalid Host header" };
    }

    const shape = classifyHostShape(
      hostname,
      this.baseDomain(),
      this.platformHost(),
      this.publicHosts(),
    );

    if (shape.kind === "empty" || shape.kind === "ip") {
      return {
        outcome: "invalid_host",
        hostname,
        message: "Host cannot be used for tenant resolution",
      };
    }
    if (shape.kind === "platform") {
      return { outcome: "platform", hostname, message: "Platform administration host" };
    }
    if (shape.kind === "public" || (shape.kind === "localhost" && !shape.slug)) {
      return { outcome: "public", hostname, message: "Public marketing host" };
    }

    // Explicit TenantDomain row wins
    const mapped = await this.prisma.tenantDomain.findUnique({
      where: { hostname },
      include: { tenant: true },
    });
    if (mapped) {
      return this.outcomeFromDomain(mapped, hostname);
    }

    // Dev: {slug}.localhost → slug lookup
    if (shape.kind === "managed_subdomain" && shape.slug) {
      if (isReservedSlug(shape.slug)) {
        return {
          outcome: "unknown",
          hostname,
          message: "Reserved subdomain",
        };
      }
      const bySlug = await this.prisma.tenant.findUnique({ where: { slug: shape.slug } });
      if (!bySlug) {
        return { outcome: "unknown", hostname, message: "Unknown tenant domain" };
      }
      // Prefer primary domain row if present
      const primary = await this.prisma.tenantDomain.findFirst({
        where: { tenantId: bySlug.id, isPrimary: true, status: { not: "removed" } },
        include: { tenant: true },
      });
      if (primary) return this.outcomeFromDomain(primary, hostname);
      return this.outcomeFromTenantInference(bySlug, hostname, "subdomain");
    }

    if (shape.kind === "other") {
      // Custom domain without row = unknown (do not trust Host alone)
      return {
        outcome: "unknown",
        hostname,
        message: "Unverified or unknown custom domain",
      };
    }

    return { outcome: "unknown", hostname, message: "Unknown tenant domain" };
  }

  private outcomeFromDomain(
    mapped: {
      id: string;
      kind: string;
      status: string;
      isPrimary: boolean;
      tenant: { id: string; slug: string; name: string; status: string };
    },
    hostname: string,
  ): ResolveOutcome {
    const base = {
      hostname,
      tenantId: mapped.tenant.id,
      tenantSlug: mapped.tenant.slug,
      tenantName: mapped.tenant.name,
      tenantStatus: mapped.tenant.status,
      domainId: mapped.id,
      domainKind: mapped.kind,
      domainStatus: mapped.status,
      isPrimary: mapped.isPrimary,
    };
    if (mapped.status === "removed") {
      return { ...base, outcome: "removed", message: "Domain removed" };
    }
    if (mapped.status === "pending") {
      return {
        ...base,
        outcome: "unverified_custom",
        message: "Domain pending verification",
      };
    }
    if (mapped.kind === "custom" && mapped.status !== "active" && mapped.status !== "verified") {
      return {
        ...base,
        outcome: "unverified_custom",
        message: "Custom domain is not verified",
      };
    }
    if (mapped.status === "suspended") {
      return { ...base, outcome: "suspended", message: "Domain suspended" };
    }
    if (mapped.tenant.status === "suspended") {
      return { ...base, outcome: "suspended", message: "Tenant suspended" };
    }
    if (mapped.tenant.status === "deactivated" || mapped.tenant.status === "provisioning_failed") {
      return { ...base, outcome: "inactive", message: `Tenant is ${mapped.tenant.status}` };
    }
    if (
      mapped.tenant.status !== "active" &&
      mapped.tenant.status !== "invitation_pending"
    ) {
      return { ...base, outcome: "inactive", message: `Tenant is ${mapped.tenant.status}` };
    }
    return { ...base, outcome: "tenant", message: "Tenant domain resolved" };
  }

  private outcomeFromTenantInference(
    tenant: { id: string; slug: string; name: string; status: string },
    hostname: string,
    kind: string,
  ): ResolveOutcome {
    const base = {
      hostname,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      tenantStatus: tenant.status,
      domainId: "",
      domainKind: kind,
      domainStatus: "inferred",
      isPrimary: true,
    };
    if (tenant.status === "suspended") {
      return { ...base, outcome: "suspended", message: "Tenant suspended" };
    }
    if (tenant.status !== "active" && tenant.status !== "invitation_pending") {
      return { ...base, outcome: "inactive", message: `Tenant is ${tenant.status}` };
    }
    return { ...base, outcome: "tenant", message: "Tenant resolved via managed subdomain" };
  }

  listReserved() {
    return [...RESERVED_SLUGS];
  }

  async listDomains(filters?: { tenantId?: string; q?: string }) {
    return this.prisma.tenantDomain.findMany({
      where: {
        ...(filters?.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters?.q
          ? {
              OR: [
                { hostname: { contains: filters.q, mode: "insensitive" } },
                { tenant: { slug: { contains: filters.q, mode: "insensitive" } } },
                { tenant: { name: { contains: filters.q, mode: "insensitive" } } },
              ],
            }
          : {}),
        status: { not: "removed" },
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async ensurePrimarySubdomain(tenantId: string, actorId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "TENANT_NOT_FOUND", message: "Tenant not found" });
    if (isReservedSlug(tenant.slug)) {
      throw new BadRequestException({
        code: "RESERVED_SLUG",
        message: "Tenant slug is reserved and cannot receive a managed subdomain",
      });
    }
    const hostname = this.managedHostnameForSlug(tenant.slug);
    const existing = await this.prisma.tenantDomain.findUnique({ where: { hostname } });
    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new ConflictException({
          code: "DOMAIN_COLLISION",
          message: "Hostname already mapped to another tenant",
        });
      }
      return existing;
    }
    const created = await this.prisma.tenantDomain.create({
      data: {
        tenantId,
        hostname,
        kind: "subdomain",
        status: "active",
        isPrimary: true,
        verifiedAt: new Date(),
        tlsStatus: "unknown",
      },
    });
    await this.recordEvent(tenantId, created.id, "domain.created", actorId, null, created);
    return created;
  }

  async assignCustomDomain(
    tenantId: string,
    hostnameRaw: string,
    actorId: string,
  ) {
    const hostname = normalizeHostname(hostnameRaw);
    if (!hostname || hostname.includes(" ")) {
      throw new BadRequestException({ code: "INVALID_HOSTNAME", message: "Invalid hostname" });
    }
    const shape = classifyHostShape(
      hostname,
      this.baseDomain(),
      this.platformHost(),
      this.publicHosts(),
    );
    if (shape.kind !== "other") {
      throw new BadRequestException({
        code: "NOT_CUSTOM",
        message: "Use managed subdomain assignment for SokoOS-managed hosts",
      });
    }
    const collision = await this.prisma.tenantDomain.findUnique({ where: { hostname } });
    if (collision && collision.status !== "removed") {
      throw new ConflictException({
        code: "DOMAIN_COLLISION",
        message: "Hostname already registered",
      });
    }
    const token = randomBytes(32).toString("hex");
    const verificationTokenHash = createHash("sha256").update(token).digest("hex");
    const created = await this.prisma.tenantDomain.create({
      data: {
        tenantId,
        hostname,
        kind: "custom",
        status: "pending",
        isPrimary: false,
        verificationTokenHash,
        tlsStatus: "unknown",
      },
    });
    await this.recordEvent(tenantId, created.id, "domain.custom_pending", actorId, null, {
      hostname,
    });
    // Return raw token once for DNS TXT verification instruction — never logged by caller
    return { domain: created, verificationToken: token };
  }

  /**
   * Mark custom domain verified only when caller supplies the correct token.
   * Does NOT claim DNS/TLS succeeded in infrastructure — status is application verification only.
   */
  async verifyCustomDomain(domainId: string, rawToken: string, actorId: string) {
    const domain = await this.prisma.tenantDomain.findUnique({ where: { id: domainId } });
    if (!domain || domain.status === "removed") {
      throw new NotFoundException({ code: "DOMAIN_NOT_FOUND", message: "Domain not found" });
    }
    if (domain.kind !== "custom") {
      throw new BadRequestException({ code: "NOT_CUSTOM", message: "Not a custom domain" });
    }
    const hash = createHash("sha256").update(rawToken).digest("hex");
    if (!domain.verificationTokenHash || domain.verificationTokenHash !== hash) {
      throw new BadRequestException({
        code: "VERIFICATION_FAILED",
        message: "Invalid verification token",
      });
    }
    const updated = await this.prisma.tenantDomain.update({
      where: { id: domainId },
      data: {
        status: "verified",
        verifiedAt: new Date(),
        dnsVerifiedAt: new Date(),
        verificationTokenHash: null,
      },
    });
    await this.recordEvent(domain.tenantId, domainId, "domain.verified", actorId, domain, updated);
    return updated;
  }

  async activateDomain(domainId: string, actorId: string) {
    const domain = await this.prisma.tenantDomain.findUnique({ where: { id: domainId } });
    if (!domain || domain.status === "removed") {
      throw new NotFoundException({ code: "DOMAIN_NOT_FOUND", message: "Domain not found" });
    }
    if (domain.kind === "custom" && domain.status !== "verified" && domain.status !== "active") {
      throw new BadRequestException({
        code: "NOT_VERIFIED",
        message: "Custom domain must be verified before activation",
      });
    }
    const updated = await this.prisma.tenantDomain.update({
      where: { id: domainId },
      data: { status: "active" },
    });
    await this.recordEvent(domain.tenantId, domainId, "domain.activated", actorId, domain, updated);
    return updated;
  }

  async setDomainStatus(
    domainId: string,
    status: "active" | "suspended" | "removed",
    actorId: string,
  ) {
    const domain = await this.prisma.tenantDomain.findUnique({ where: { id: domainId } });
    if (!domain) {
      throw new NotFoundException({ code: "DOMAIN_NOT_FOUND", message: "Domain not found" });
    }
    const updated = await this.prisma.tenantDomain.update({
      where: { id: domainId },
      data: { status },
    });
    await this.recordEvent(domain.tenantId, domainId, `domain.${status}`, actorId, domain, updated);
    return updated;
  }

  async domainHistory(tenantId: string) {
    return this.prisma.tenantDomainEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async backfillAllPrimarySubdomains(actorId?: string) {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { not: "deactivated" } },
      select: { id: true, slug: true },
    });
    const results = [];
    for (const t of tenants) {
      if (isReservedSlug(t.slug)) continue;
      results.push(await this.ensurePrimarySubdomain(t.id, actorId));
    }
    return { count: results.length, domains: results };
  }

  private async recordEvent(
    tenantId: string,
    domainId: string | null,
    action: string,
    actorId: string | undefined,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.tenantDomainEvent.create({
      data: {
        tenantId,
        domainId,
        action,
        actorId: actorId ?? null,
        before: before ? (JSON.parse(JSON.stringify(before)) as object) : undefined,
        after: after ? (JSON.parse(JSON.stringify(after)) as object) : undefined,
      },
    });
  }
}
