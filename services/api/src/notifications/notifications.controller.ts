import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions("notifications.read")
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: { unreadOnly?: string; limit?: string },
  ) {
    return {
      data: await this.notifications.list(user.tenantId!, user.id, {
        unreadOnly: query.unreadOnly === "true",
        limit: query.limit ? Number(query.limit) : undefined,
      }),
    };
  }

  @Post(":id/read")
  @RequirePermissions("notifications.read")
  async markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return {
      data: await this.notifications.markRead(user.tenantId!, user.id, id),
    };
  }

  @Post("read-all")
  @RequirePermissions("notifications.read")
  async markAllRead(@CurrentUser() user: AuthUser) {
    return {
      data: await this.notifications.markAllRead(user.tenantId!, user.id),
    };
  }
}
