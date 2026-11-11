import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { HardwareService } from "./hardware.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class ReceiveDto {
  @IsUUID() productId!: string;
  @IsString() @MinLength(1) serialNumber!: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() purchaseId?: string;
  @IsOptional() @IsInt() @Min(0) warrantyMonths?: number;
  @IsOptional() @IsString() notes?: string;
}

class SellDto {
  @IsString() serialNumber!: string;
  @IsUUID() saleId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsInt() @Min(0) warrantyMonths?: number;
}

class NoteDto {
  @IsOptional() @IsString() note?: string;
}

@Controller("hardware")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HardwareController {
  constructor(private readonly hardware: HardwareService) {}

  @Get("serials")
  @RequirePermissions("inventory.read", "products.read")
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: { productId?: string; status?: string; q?: string },
  ) {
    return this.hardware.listSerials(user.tenantId!, query).then((data) => ({ data }));
  }

  @Get("serials/:serialNumber")
  @RequirePermissions("inventory.read", "products.read")
  history(@CurrentUser() user: AuthUser, @Param("serialNumber") serialNumber: string) {
    return this.hardware.history(user.tenantId!, decodeURIComponent(serialNumber)).then((data) => ({ data }));
  }

  @Post("serials/receive")
  @RequirePermissions("inventory.adjust", "purchases.receive")
  receive(@CurrentUser() user: AuthUser, @Body() body: ReceiveDto) {
    return this.hardware.receiveSerial(user.tenantId!, user.id, body).then((data) => ({ data }));
  }

  @Post("serials/sell")
  @RequirePermissions("sales.create")
  sell(@CurrentUser() user: AuthUser, @Body() body: SellDto) {
    return this.hardware.sellSerial(user.tenantId!, user.id, body).then((data) => ({ data }));
  }

  @Post("serials/:serialNumber/return")
  @RequirePermissions("returns.create", "sales.create")
  ret(@CurrentUser() user: AuthUser, @Param("serialNumber") serialNumber: string, @Body() body: NoteDto) {
    return this.hardware
      .returnSerial(user.tenantId!, user.id, decodeURIComponent(serialNumber), body.note)
      .then((data) => ({ data }));
  }

  @Post("serials/:serialNumber/repair/open")
  @RequirePermissions("sales.create")
  repairOpen(@CurrentUser() user: AuthUser, @Param("serialNumber") serialNumber: string, @Body() body: NoteDto) {
    return this.hardware
      .openRepair(user.tenantId!, user.id, decodeURIComponent(serialNumber), body.note)
      .then((data) => ({ data }));
  }

  @Post("serials/:serialNumber/repair/close")
  @RequirePermissions("sales.create")
  repairClose(@CurrentUser() user: AuthUser, @Param("serialNumber") serialNumber: string) {
    return this.hardware
      .closeRepair(user.tenantId!, user.id, decodeURIComponent(serialNumber))
      .then((data) => ({ data }));
  }
}
