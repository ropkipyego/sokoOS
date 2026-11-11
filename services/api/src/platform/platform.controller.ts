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
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { PlatformService, type OnboardingPayload } from "./platform.service";
import { PlatformConsoleService } from "./platform-console.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";
import { HealthService } from "../health/health.service";

class SaveDraftDto {
  @IsInt() @Min(1) step!: number;
  @IsObject() payload!: OnboardingPayload;
}

class StatusDto {
  @IsString() status!: "active" | "suspended";
}

class ModulesDto {
  @IsOptional() @IsArray() businessTypes?: string[];
  @IsOptional() @IsObject() modulesEnabled?: Record<string, boolean>;
}

class UserStatusDto {
  @IsString() status!: string;
}

class SettingDto {
  @IsString() @MinLength(1) key!: string;
  value!: unknown;
}

@Controller("platform")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly console: PlatformConsoleService,
    private readonly health: HealthService,
  ) {}

  @Get("overview")
  @RequirePermissions("platform.tenants.read", "platform.tenants.manage")
  overview() {
    return this.console.richOverview().then((data) => ({ data }));
  }

  @Get("ops")
  @RequirePermissions("platform.health.read", "platform.tenants.read", "platform.tenants.manage")
  ops() {
    return this.health.platformOps().then((data) => ({ data }));
  }

  @Get("tenants")
  @RequirePermissions("platform.tenants.read", "platform.tenants.manage")
  listTenants() {
    return this.platform.listTenants().then((data) => ({ data }));
  }

  @Get("tenants/:tenantId")
  @RequirePermissions("platform.tenants.read", "platform.tenants.manage")
  getTenant(@Param("tenantId") tenantId: string) {
    return this.platform.getTenant(tenantId).then((data) => ({ data }));
  }

  @Patch("tenants/:tenantId/status")
  @RequirePermissions("platform.tenants.manage")
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("tenantId") tenantId: string,
    @Body() body: StatusDto,
  ) {
    return this.platform.setTenantStatus(tenantId, body.status, user.id).then((data) => ({ data }));
  }

  @Patch("tenants/:tenantId/modules")
  @RequirePermissions("platform.tenants.manage")
  modules(
    @CurrentUser() user: AuthUser,
    @Param("tenantId") tenantId: string,
    @Body() body: ModulesDto,
  ) {
    return this.platform
      .updateTenantModules(
        tenantId,
        {
          businessTypes: body.businessTypes as never,
          modulesEnabled: body.modulesEnabled,
        },
        user.id,
      )
      .then((data) => ({ data }));
  }

  @Get("onboarding/drafts")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  listDrafts(@CurrentUser() user: AuthUser) {
    return this.platform.listDrafts(user.id).then((data) => ({ data }));
  }

  @Post("onboarding/drafts")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  createDraft(@CurrentUser() user: AuthUser) {
    return this.platform.createDraft(user.id).then((data) => ({ data }));
  }

  @Get("onboarding/drafts/:id")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  getDraft(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.platform.getDraft(id, user.id).then((data) => ({ data }));
  }

  @Patch("onboarding/drafts/:id")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: SaveDraftDto,
  ) {
    return this.platform.saveDraft(id, user.id, body.step, body.payload).then((data) => ({ data }));
  }

  @Post("onboarding/drafts/:id/activate")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  activate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.platform.activateDraft(id, user.id).then((data) => ({ data }));
  }

  // --- Control plane workspaces ---

  @Get("users/platform")
  @RequirePermissions("platform.users.manage", "platform.tenants.read")
  platformUsers() {
    return this.console.listPlatformUsers().then((data) => ({ data }));
  }

  @Patch("users/platform/:userId/status")
  @RequirePermissions("platform.users.manage")
  platformUserStatus(
    @CurrentUser() user: AuthUser,
    @Param("userId") userId: string,
    @Body() body: UserStatusDto,
  ) {
    return this.console
      .setPlatformUserStatus(userId, body.status, user.id)
      .then((data) => ({ data }));
  }

  @Get("users/tenants")
  @RequirePermissions("platform.tenants.read", "platform.users.manage")
  tenantUsers(@Query("q") q?: string) {
    return this.console.listTenantUsers(q).then((data) => ({ data }));
  }

  @Get("devices")
  @RequirePermissions("platform.devices.read", "platform.tenants.read", "platform.tenants.manage")
  devices(@Query("q") q?: string) {
    return this.console.listDevices(q).then((data) => ({ data }));
  }

  @Get("audit")
  @RequirePermissions("platform.audit.read", "platform.tenants.read")
  audit(@Query("q") q?: string, @Query("limit") limit?: string) {
    return this.console
      .listAudit({ q, limit: limit ? Number(limit) : undefined })
      .then((data) => ({ data }));
  }

  @Get("entitlements")
  @RequirePermissions("platform.billing.read", "platform.tenants.read")
  entitlements() {
    return this.console.listEntitlementsMatrix().then((data) => ({ data }));
  }

  @Get("integrations")
  @RequirePermissions("platform.integrations.read", "platform.tenants.read", "platform.health.read")
  integrations() {
    return this.console.integrationsSafety().then((data) => ({ data }));
  }

  @Get("settings")
  @RequirePermissions("platform.settings.read", "platform.settings.manage", "platform.tenants.manage")
  settings() {
    return this.console.getSettings().then((data) => ({ data }));
  }

  @Post("settings")
  @RequirePermissions("platform.settings.manage", "platform.tenants.manage")
  setSetting(@CurrentUser() user: AuthUser, @Body() body: SettingDto) {
    return this.console.setSetting(body.key, body.value, user.id).then((data) => ({ data }));
  }
}
