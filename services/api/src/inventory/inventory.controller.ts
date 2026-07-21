import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { InventoryService } from "./inventory.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class CreateWarehouseDto {
  @IsUUID() branchId!: string;
  @IsString() name!: string;
  @IsOptional() isDefault?: boolean;
}

class CreateMovementDto {
  @IsOptional() @IsUUID() id?: string;
  @IsUUID() warehouseId!: string;
  @IsUUID() productId!: string;
  @IsUUID() branchId!: string;
  @IsString() type!: string;
  @IsInt() quantityDelta!: number;
  @IsOptional() @IsInt() unitCostMinor?: number;
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @IsUUID() referenceId?: string;
  @IsOptional() @IsString() reason?: string;
}

class TransferDto {
  @IsUUID() fromWarehouseId!: string;
  @IsUUID() toWarehouseId!: string;
  @IsUUID() productId!: string;
  @IsUUID() branchId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() reason?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("warehouses")
  @RequirePermissions("inventory.read")
  async warehouses(
    @CurrentUser() user: AuthUser,
    @Query("branchId") branchId?: string,
  ) {
    return {
      data: await this.inventory.listWarehouses(user.tenantId!, branchId),
    };
  }

  @Post("warehouses")
  @RequirePermissions("inventory.adjust")
  async createWarehouse(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateWarehouseDto,
  ) {
    return {
      data: await this.inventory.createWarehouse(user.tenantId!, body, user.id),
    };
  }

  @Get("stock/balances")
  @RequirePermissions("inventory.read")
  async balances(
    @CurrentUser() user: AuthUser,
    @Query()
    query: {
      warehouseId?: string;
      productId?: string;
      limit?: string;
      cursor?: string;
    },
  ) {
    return this.inventory.listBalances(user.tenantId!, {
      warehouseId: query.warehouseId,
      productId: query.productId,
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor,
    });
  }

  @Get("stock/movements")
  @RequirePermissions("inventory.read")
  async movements(
    @CurrentUser() user: AuthUser,
    @Query()
    query: {
      warehouseId?: string;
      productId?: string;
      type?: string;
      from?: string;
      to?: string;
      limit?: string;
      cursor?: string;
    },
  ) {
    return this.inventory.listMovements(user.tenantId!, {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Post("stock/movements")
  @RequirePermissions("inventory.adjust")
  async createMovement(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateMovementDto,
  ) {
    return {
      data: await this.inventory.createMovement(
        user.tenantId!,
        {
          ...body,
          deviceId: user.deviceId ?? null,
        },
        user.id,
      ),
    };
  }

  @Post("stock/transfers")
  @RequirePermissions("inventory.transfer")
  async transfer(@CurrentUser() user: AuthUser, @Body() body: TransferDto) {
    return {
      data: await this.inventory.transfer(user.tenantId!, body, user.id),
    };
  }
}
