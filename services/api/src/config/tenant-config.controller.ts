import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { TenantConfigService } from "./tenant-config.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class OverrideDto {
  @IsIn(["tenant", "branch", "department", "device"]) layer!: "tenant" | "branch" | "department" | "device";
  @IsString() @MinLength(1) key!: string;
  value!: unknown;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() deviceId?: string;
}

@Controller("config")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantConfigController {
  constructor(private readonly config: TenantConfigService) {}

  @Get("effective")
  @RequirePermissions("tenant.settings.read")
  effective(
    @CurrentUser() user: AuthUser,
    @Query() query: { branchId?: string; departmentId?: string; deviceId?: string },
  ) {
    return this.config.resolveEffective(user.tenantId!, query).then((data) => ({ data }));
  }

  @Get("overrides")
  @RequirePermissions("tenant.settings.read")
  overrides(@CurrentUser() user: AuthUser) {
    return this.config.listOverrides(user.tenantId!).then((data) => ({ data }));
  }

  @Post("overrides")
  @RequirePermissions("tenant.settings.write")
  set(@CurrentUser() user: AuthUser, @Body() body: OverrideDto) {
    return this.config.setOverride(user.tenantId!, user.id, body).then((data) => ({ data }));
  }

  @Delete("overrides/:id")
  @RequirePermissions("tenant.settings.write")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.config.deleteOverride(user.tenantId!, id, user.id).then((data) => ({ data }));
  }
}
