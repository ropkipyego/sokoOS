import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { DeliveriesService } from "./deliveries.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class CreateDeliveryDto {
  @IsUUID() saleId!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsInt() @Min(0) feeMinor?: number;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsUUID() assigneeUserId?: string;
  @IsOptional() @IsUUID() customerId?: string;
}

class UpdateDeliveryDto {
  @IsString() status!: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsUUID() assigneeUserId?: string;
}

@Controller("deliveries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  @RequirePermissions("deliveries.read")
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: { status?: string; branchId?: string; limit?: string; cursor?: string },
  ) {
    return this.deliveries.list(user.tenantId!, {
      status: query.status,
      branchId: query.branchId,
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor,
    });
  }

  @Post()
  @RequirePermissions("deliveries.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateDeliveryDto) {
    return { data: await this.deliveries.create(user.tenantId!, body, user.id) };
  }

  @Get(":id")
  @RequirePermissions("deliveries.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return { data: await this.deliveries.get(user.tenantId!, id) };
  }

  @Patch(":id")
  @RequirePermissions("deliveries.write")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: UpdateDeliveryDto) {
    return { data: await this.deliveries.updateStatus(user.tenantId!, id, body, user.id) };
  }
}
