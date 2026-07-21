import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions("audit.read")
  async list(
    @CurrentUser() user: AuthUser,
    @Query()
    query: {
      limit?: string;
      cursor?: string;
      actorUserId?: string;
      entityType?: string;
      action?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.audit.list(user.tenantId!, {
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor,
      actorUserId: query.actorUserId,
      entityType: query.entityType,
      action: query.action,
      from: query.from,
      to: query.to,
    });
  }
}
