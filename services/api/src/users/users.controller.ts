import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

function requireTenant(user: AuthUser): string {
  if (!user.tenantId) {
    throw new ForbiddenException({
      code: "TENANT_REQUIRED",
      message: "Tenant context required",
    });
  }
  return user.tenantId;
}

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsUUID() roleId?: string;
  @IsOptional() @IsUUID() branchId?: string;
}

class InviteUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsUUID() roleId?: string;
  @IsOptional() @IsUUID() branchId?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() status?: string;
}

class AssignRoleDto {
  @IsUUID() roleId!: string;
  @IsOptional() @IsUUID() branchId?: string;
}

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsString() cursor?: string;
}

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions("users.read")
  async list(@CurrentUser() user: AuthUser, @Query() query: ListQuery) {
    return this.users.list(requireTenant(user), query);
  }

  @Post()
  @RequirePermissions("users.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateUserDto) {
    const data = await this.users.create(requireTenant(user), body);
    return { data };
  }

  @Post("invite")
  @RequirePermissions("users.write")
  async invite(@CurrentUser() user: AuthUser, @Body() body: InviteUserDto) {
    const data = await this.users.invite(requireTenant(user), user.id, body);
    return { data };
  }

  @Get(":id")
  @RequirePermissions("users.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const data = await this.users.get(requireTenant(user), id);
    return { data };
  }

  @Patch(":id")
  @RequirePermissions("users.write")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateUserDto,
  ) {
    const data = await this.users.update(requireTenant(user), id, body);
    return { data };
  }

  @Post(":id/roles")
  @RequirePermissions("users.write")
  async assignRole(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: AssignRoleDto,
  ) {
    const data = await this.users.assignRole(requireTenant(user), id, body);
    return { data };
  }

  @Delete(":id/roles/:userRoleId")
  @RequirePermissions("users.write")
  async removeRole(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("userRoleId") userRoleId: string,
  ) {
    const data = await this.users.removeRole(requireTenant(user), id, userRoleId);
    return { data };
  }
}
