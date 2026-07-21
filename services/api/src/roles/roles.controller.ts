import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { IsArray, IsString, MinLength } from "class-validator";
import { RolesService } from "./roles.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class CreateRoleDto {
  @IsString()
  @MinLength(2)
  key!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

class SetPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get("roles")
  @RequirePermissions("roles.read")
  async list(@CurrentUser() user: AuthUser) {
    const data = await this.roles.listRoles(user.tenantId!);
    return { data };
  }

  @Get("roles/:id")
  @RequirePermissions("roles.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const data = await this.roles.getRole(user.tenantId!, id);
    return { data };
  }

  @Post("roles")
  @RequirePermissions("roles.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateRoleDto) {
    const data = await this.roles.createRole(user.tenantId!, body);
    return { data };
  }

  @Put("roles/:id/permissions")
  @RequirePermissions("roles.write")
  async setPermissions(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: SetPermissionsDto,
  ) {
    const data = await this.roles.setRolePermissions(
      user.tenantId!,
      id,
      body.permissionKeys,
    );
    return { data };
  }

  @Get("permissions")
  @RequirePermissions("roles.read")
  async permissions() {
    const data = await this.roles.listPermissions();
    return { data };
  }

  @Get("authz/version")
  async authzVersion(@CurrentUser() user: AuthUser) {
    const version = user.tenantId
      ? await this.roles.getAuthzVersion(user.tenantId)
      : 0;
    return { data: { authzVersion: version } };
  }
}
