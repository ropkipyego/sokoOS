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
}
