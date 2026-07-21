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
import { IsInt, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { BranchesService } from "./branches.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class CreateBranchDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsObject() address?: object;
}

class UpdateBranchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsObject() settings?: object;
}

class ListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsString() cursor?: string;
}

@Controller("branches")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions("branches.read")
  async list(@CurrentUser() user: AuthUser, @Query() query: ListQuery) {
    return this.branches.list(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions("branches.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateBranchDto) {
    const data = await this.branches.create(user.tenantId!, body, user.id);
    return { data };
  }

  @Get(":id")
  @RequirePermissions("branches.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const data = await this.branches.get(user.tenantId!, id);
    return { data };
  }

  @Patch(":id")
  @RequirePermissions("branches.write")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateBranchDto,
  ) {
    const data = await this.branches.update(user.tenantId!, id, body, user.id);
    return { data };
  }

  @Post(":id/archive")
  @RequirePermissions("branches.write")
  async archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const data = await this.branches.archive(user.tenantId!, id, user.id);
    return { data };
  }
}
