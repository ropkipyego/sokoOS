import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { ShiftsService } from "./shifts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class OpenDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() deviceId?: string;
  @IsOptional() @IsInt() @Min(0) openingFloatMinor?: number;
}

class CloseDto {
  @IsInt() @Min(0) closingCountedMinor!: number;
  @IsOptional() @IsString() notes?: string;
}

@Controller("shifts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  @RequirePermissions("sales.read", "reports.read")
  list(@CurrentUser() user: AuthUser, @Query("status") status?: string) {
    return this.shifts.list(user.tenantId!, status).then((data) => ({ data }));
  }

  @Get("current")
  @RequirePermissions("sales.create", "sales.read")
  current(@CurrentUser() user: AuthUser) {
    return this.shifts.current(user.tenantId!, user.id).then((data) => ({ data }));
  }

  @Post("open")
  @RequirePermissions("sales.create")
  open(@CurrentUser() user: AuthUser, @Body() body: OpenDto) {
    return this.shifts.open(user.tenantId!, user.id, body).then((data) => ({ data }));
  }

  @Post(":id/close")
  @RequirePermissions("sales.create")
  close(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: CloseDto) {
    return this.shifts.close(user.tenantId!, id, user.id, body).then((data) => ({ data }));
  }
}
