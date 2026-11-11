import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  live() {
    return {
      status: "ok",
      service: "@sokoos/api",
      ts: new Date().toISOString(),
    };
  }

  /**
   * Ready: Postgres required; Redis optional (status field only).
   * Returns HTTP 200 when postgres is up even if redis is down.
   */
  async ready() {
    let postgres = false;
    let redis = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      postgres = true;
    } catch {
      postgres = false;
    }

    try {
      redis = await this.redis.ping();
    } catch {
      redis = false;
    }

    return {
      status: postgres ? "ok" : "unavailable",
      postgres,
      redis,
      checks: {
        database: postgres ? "up" : "down",
        redis: redis ? "up" : "down",
      },
      ts: new Date().toISOString(),
    };
  }

  /**
   * Platform ops snapshot — real counters only; never includes secrets.
   * Distinguishes healthy / degraded / unavailable / unknown.
   */
  async platformOps() {
    const ready = await this.ready();
    let emailQueued = 0;
    let emailFailed = 0;
    let provisioningFailed = 0;
    let openTickets = 0;
    let tenantsActive = 0;
    let domainsPending = 0;

    try {
      ;[emailQueued, emailFailed, provisioningFailed, openTickets, tenantsActive, domainsPending] =
        await Promise.all([
          this.prisma.emailMessage.count({ where: { status: { in: ["queued", "retried"] } } }),
          this.prisma.emailMessage.count({ where: { status: "failed" } }),
          this.prisma.tenant.count({ where: { status: "provisioning_failed" } }),
          this.prisma.supportTicket.count({ where: { status: { in: ["open", "pending"] } } }),
          this.prisma.tenant.count({ where: { status: "active" } }),
          this.prisma.tenantDomain.count({ where: { status: "pending" } }),
        ]);
    } catch {
      /* counts unknown if schema mid-migrate */
    }

    const components: Record<string, "healthy" | "degraded" | "unavailable" | "unknown"> = {
      api: "healthy",
      database: ready.postgres ? "healthy" : "unavailable",
      redis: ready.redis ? "healthy" : "unknown",
      email:
        emailFailed > 0 ? "degraded" : emailQueued > 50 ? "degraded" : "healthy",
      provisioning: provisioningFailed > 0 ? "degraded" : "healthy",
    };

    const overall = Object.values(components).includes("unavailable")
      ? "unavailable"
      : Object.values(components).includes("degraded")
        ? "degraded"
        : "healthy";

    return {
      overall,
      components,
      counters: {
        emailQueued,
        emailFailed,
        provisioningFailed,
        openTickets,
        tenantsActive,
        domainsPending,
      },
      ts: new Date().toISOString(),
    };
  }
}
