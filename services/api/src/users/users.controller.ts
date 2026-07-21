import {
  Body,
  Controller,
  Delete,
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

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(8) password!: string;
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
    return this.users.list(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions("users.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateUserDto) {
    const data = await this.users.create(user.tenantId!, body);
    return { data };
  }

  @Get(":id")
  @RequirePermissions("users.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const data = await this.users.get(user.tenantId!, id);
    return { data };
  }

  @Patch(":id")
  @RequirePermissions("users.write")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateUserDto,
  ) {
    const data = await this.users.update(user.tenantId!, id, body);
    return { data };
  }

  @Post(":id/roles")
  @RequirePermissions("users.write")
  async assignRole(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: AssignRoleDto,
  ) {
    const data = await this.users.assignRole(user.tenantId!, id, body);
    return { data };
  }

  @Delete(":id/roles/:userRoleId")
  @RequirePermissions("users.write")
  async removeRole(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("userRoleId") userRoleId: string,
  ) {
    const data = await this.users.removeRole(user.tenantId!, id, userRoleId);
    return { data };
  }
}
