import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PurchasesService } from "./purchases.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class PurchaseItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsInt() @Min(0) unitCostMinor!: number;
}

class CreatePurchaseDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() reference?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}

class ReceiveDto {
  @IsUUID() warehouseId!: string;
}

@Controller("purchases")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @RequirePermissions("purchases.read")
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: { limit?: string; cursor?: string; branchId?: string },
  ) {
    return this.purchases.list(user.tenantId!, {
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor,
      branchId: query.branchId,
    });
  }

  @Post()
  @RequirePermissions("purchases.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreatePurchaseDto) {
    return { data: await this.purchases.create(user.tenantId!, body, user.id) };
  }

  @Get(":id")
  @RequirePermissions("purchases.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return { data: await this.purchases.get(user.tenantId!, id) };
  }

  @Post(":id/receive")
  @RequirePermissions("purchases.receive")
  async receive(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: ReceiveDto,
  ) {
    return { data: await this.purchases.receive(user.tenantId!, id, body, user.id) };
  }
}
