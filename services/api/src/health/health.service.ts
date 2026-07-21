import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live() {
    return {
      status: "ok",
      service: "@sokoos/api",
      ts: new Date().toISOString(),
    };
  }

  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        checks: { database: "up" },
        ts: new Date().toISOString(),
      };
    } catch {
      return {
        status: "degraded",
        checks: { database: "down" },
        ts: new Date().toISOString(),
      };
    }
  }
}
