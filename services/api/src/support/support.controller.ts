import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";
import { SupportService } from "./support.service";
import { ForbiddenException } from "@nestjs/common";

class CreateTicketDto {
  @IsString() @MinLength(3) subject!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() tenantId?: string;
}

class MessageDto {
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
}

class StatusDto {
  @IsString() status!: string;
  @IsOptional() @IsString() assigneeUserId?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get("platform/support/tickets")
  @RequirePermissions("platform.support.read", "platform.support.manage", "platform.tenants.read")
  listPlatform(@Query("status") status?: string) {
    return this.support.listPlatform({ status }).then((data) => ({ data }));
  }

  @Get("platform/support/tickets/:id")
  @RequirePermissions("platform.support.read", "platform.support.manage", "platform.tenants.read")
  getPlatform(@Param("id") id: string) {
    return this.support.getForPlatform(id).then((data) => ({ data }));
  }

  @Post("platform/support/tickets")
  @RequirePermissions("platform.support.manage", "platform.tenants.manage")
  createPlatform(@CurrentUser() user: AuthUser, @Body() body: CreateTicketDto) {
    return this.support
      .createTicket({
        tenantId: body.tenantId,
        origin: "platform",
        subject: body.subject,
        category: body.category,
        priority: body.priority,
        body: body.body,
        requesterUserId: user.id,
        requesterEmail: user.email,
      })
      .then((data) => ({ data }));
  }

  @Post("platform/support/tickets/:id/messages")
  @RequirePermissions("platform.support.manage")
  messagePlatform(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: MessageDto,
  ) {
    return this.support
      .addMessage(id, {
        body: body.body,
        authorUserId: user.id,
        authorEmail: user.email,
        authorRole: "agent",
        isInternal: body.isInternal,
        platformActor: true,
      })
      .then((data) => ({ data }));
  }

  @Patch("platform/support/tickets/:id/status")
  @RequirePermissions("platform.support.manage")
  status(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: StatusDto,
  ) {
    return this.support
      .updateStatus(id, body.status, user.id, { assigneeUserId: body.assigneeUserId })
      .then((data) => ({ data }));
  }

  @Get("support/tickets")
  listTenant(@CurrentUser() user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException({ code: "TENANT_REQUIRED", message: "Tenant required" });
    }
    return this.support.listTenant(user.tenantId).then((data) => ({ data }));
  }

  @Get("support/tickets/:id")
  getTenant(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    if (!user.tenantId) {
      throw new ForbiddenException({ code: "TENANT_REQUIRED", message: "Tenant required" });
    }
    return this.support.getForTenant(id, user.tenantId).then((data) => ({ data }));
  }

  @Post("support/tickets")
  createTenant(@CurrentUser() user: AuthUser, @Body() body: CreateTicketDto) {
    if (!user.tenantId) {
      throw new ForbiddenException({ code: "TENANT_REQUIRED", message: "Tenant required" });
    }
    return this.support
      .createTicket({
        tenantId: user.tenantId,
        origin: "tenant",
        subject: body.subject,
        category: body.category,
        priority: body.priority,
        body: body.body,
        requesterUserId: user.id,
        requesterEmail: user.email,
      })
      .then((data) => ({ data }));
  }

  @Post("support/tickets/:id/messages")
  messageTenant(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: MessageDto,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException({ code: "TENANT_REQUIRED", message: "Tenant required" });
    }
    return this.support
      .addMessage(id, {
        body: body.body,
        authorUserId: user.id,
        authorEmail: user.email,
        authorRole: "customer",
        isInternal: false,
        tenantId: user.tenantId,
        platformActor: false,
      })
      .then((data) => ({ data }));
  }
}
