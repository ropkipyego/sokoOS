import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async setTenantLifecycle(tenantId: string, status: string, actorUserId: string) {
    const existing = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      throw new NotFoundException({ code: "TENANT_NOT_FOUND", message: "Tenant not found" });
    }
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: "platform.tenant.lifecycle",
        entityType: "tenant",
        entityId: tenantId,
        metadata: { from: existing.status, to: status },
      },
    });
    return tenant;
  }
}
