import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { TenantsService } from "./tenants.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsObject() taxConfig?: object;
  @IsOptional() @IsObject() settings?: object;
}

class CreateTenantDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(2) slug!: string;
  @IsString() currency!: string;
  @IsString() timezone!: string;
  @IsString() locale!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get("tenant")
  @RequirePermissions("tenant.settings.read")
  async current(@CurrentUser() user: AuthUser) {
    const data = await this.tenants.getCurrent(user.tenantId!);
    return { data };
  }

  @Patch("tenant")
  @RequirePermissions("tenant.settings.write")
  async update(@CurrentUser() user: AuthUser, @Body() body: UpdateTenantDto) {
    const data = await this.tenants.updateCurrent(user.tenantId!, body);
    return { data };
  }

  @Get("platform/tenants")
  @RequirePermissions("platform.tenants.manage")
  async listPlatform() {
    const data = await this.tenants.listPlatform();
    return { data };
  }

  @Post("platform/tenants")
  @RequirePermissions("platform.tenants.manage")
  async createPlatform(@Body() body: CreateTenantDto) {
    const data = await this.tenants.createPlatform(body);
    return { data };
  }

  @Get("platform/tenants/:tenantId")
  @RequirePermissions("platform.tenants.manage")
  async getPlatform(@Param("tenantId") tenantId: string) {
    const data = await this.tenants.getCurrent(tenantId);
    return { data };
  }
}
