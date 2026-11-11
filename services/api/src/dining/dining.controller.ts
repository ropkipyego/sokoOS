import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { DiningService } from "./dining.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class TableSeedDto {
  @IsString() code!: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsInt() @Min(1) seats?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}

class UpsertTablesDto {
  @IsUUID() branchId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TableSeedDto)
  tables!: TableSeedDto[];
}

class StatusDto {
  @IsString() status!: string;
}

class WaiterDto {
  @IsOptional() @IsUUID() waiterUserId?: string | null;
}

class OpenCheckDto {
  @IsUUID() branchId!: string;
  @IsUUID() tableId!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() waiterUserId?: string;
}

class AddItemsDto {
  @IsArray()
  items!: Array<{ productId: string; quantity: number; unitPriceMinor?: number; notes?: string }>;
}

class TransferDto {
  @IsUUID() toTableId!: string;
}

class SplitItemDto {
  @IsUUID() saleItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}

class SplitDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => SplitItemDto)
  items!: SplitItemDto[];
}

class MergeDto {
  @IsUUID() targetSaleId!: string;
}

class CloseDto {
  @IsArray()
  payments!: Array<{ method: string; amountMinor: number; reference?: string }>;
}

@Controller("dining")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DiningController {
  constructor(private readonly dining: DiningService) {}

  @Get("tables")
  @RequirePermissions("sales.read")
  async list(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return { data: await this.dining.list(user.tenantId!, branchId) };
  }

  @Get("floor")
  @RequirePermissions("sales.read")
  async floor(@CurrentUser() user: AuthUser, @Query("branchId") branchId: string) {
    return { data: await this.dining.floor(user.tenantId!, branchId) };
  }

  @Post("tables")
  @RequirePermissions("tenant.settings.write")
  async upsert(@CurrentUser() user: AuthUser, @Body() body: UpsertTablesDto) {
    return { data: await this.dining.upsertMany(user.tenantId!, body.branchId, body.tables) };
  }

  @Patch("tables/:id/status")
  @RequirePermissions("sales.create")
  async status(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: StatusDto) {
    return { data: await this.dining.setStatus(user.tenantId!, id, body.status) };
  }

  @Patch("tables/:id/waiter")
  @RequirePermissions("sales.create")
  async waiter(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: WaiterDto) {
    return { data: await this.dining.assignWaiter(user.tenantId!, id, body.waiterUserId ?? null) };
  }

  @Post("checks")
  @RequirePermissions("sales.create")
  async open(@CurrentUser() user: AuthUser, @Body() body: OpenCheckDto) {
    return { data: await this.dining.openCheck(user.tenantId!, user.id, body) };
  }

  @Post("checks/:saleId/items")
  @RequirePermissions("sales.create")
  async addItems(@CurrentUser() user: AuthUser, @Param("saleId") saleId: string, @Body() body: AddItemsDto) {
    return { data: await this.dining.addItems(user.tenantId!, saleId, body.items) };
  }

  @Post("checks/:saleId/send-kitchen")
  @RequirePermissions("sales.create")
  async send(@CurrentUser() user: AuthUser, @Param("saleId") saleId: string) {
    return { data: await this.dining.sendToKitchen(user.tenantId!, saleId) };
  }

  @Post("checks/:saleId/transfer")
  @RequirePermissions("sales.create")
  async transfer(@CurrentUser() user: AuthUser, @Param("saleId") saleId: string, @Body() body: TransferDto) {
    return { data: await this.dining.transferTable(user.tenantId!, saleId, body.toTableId) };
  }

  @Post("checks/:saleId/split")
  @RequirePermissions("sales.create")
  async split(@CurrentUser() user: AuthUser, @Param("saleId") saleId: string, @Body() body: SplitDto) {
    return { data: await this.dining.splitByItems(user.tenantId!, saleId, user.id, body.items) };
  }

  @Post("checks/:saleId/merge")
  @RequirePermissions("sales.create")
  async merge(@CurrentUser() user: AuthUser, @Param("saleId") saleId: string, @Body() body: MergeDto) {
    return { data: await this.dining.mergeChecks(user.tenantId!, saleId, body.targetSaleId) };
  }

  @Post("checks/:saleId/close")
  @RequirePermissions("sales.create")
  async close(@CurrentUser() user: AuthUser, @Param("saleId") saleId: string, @Body() body: CloseDto) {
    return { data: await this.dining.closeCheck(user.tenantId!, saleId, body.payments, user.id) };
  }
}

/** Backward-compatible alias for older clients using /dining-tables */
@Controller("dining-tables")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DiningTablesLegacyController {
  constructor(private readonly dining: DiningService) {}

  @Get()
  @RequirePermissions("sales.read")
  async list(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return { data: await this.dining.list(user.tenantId!, branchId) };
  }

  @Post()
  @RequirePermissions("tenant.settings.write")
  async upsert(@CurrentUser() user: AuthUser, @Body() body: UpsertTablesDto) {
    return { data: await this.dining.upsertMany(user.tenantId!, body.branchId, body.tables) };
  }

  @Patch(":id/status")
  @RequirePermissions("sales.create")
  async status(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: StatusDto) {
    return { data: await this.dining.setStatus(user.tenantId!, id, body.status) };
  }
}
