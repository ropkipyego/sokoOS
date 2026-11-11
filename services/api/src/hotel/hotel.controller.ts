import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { HotelService } from "./hotel.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class RoomTypeDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) baseRateMinor!: number;
  @IsOptional() @IsInt() maxOccupancy?: number;
}

class RoomDto {
  @IsUUID() branchId!: string;
  @IsUUID() roomTypeId!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}

class ReservationDto {
  @IsUUID() branchId!: string;
  @IsString() guestName!: string;
  @IsOptional() @IsString() guestPhone?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() roomTypeId?: string;
  @IsString() checkInDate!: string;
  @IsString() checkOutDate!: string;
  @IsOptional() @IsInt() adults?: number;
  @IsOptional() @IsInt() children?: number;
  @IsOptional() @IsString() notes?: string;
}

class CheckInDto {
  @IsUUID() roomId!: string;
}

class FolioPostDto {
  @IsUUID() saleId!: string;
  @IsOptional() @IsString() description?: string;
}

class SettleDto {
  @IsString() method!: string;
  @IsInt() @Min(0) amountMinor!: number;
  @IsOptional() @IsString() reference?: string;
}

class StatusDto {
  @IsString() status!: string;
}

@Controller("hotel")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HotelController {
  constructor(private readonly hotel: HotelService) {}

  @Get("room-types")
  @RequirePermissions("sales.read", "tenant.settings.read")
  roomTypes(@CurrentUser() user: AuthUser) {
    return this.hotel.listRoomTypes(user.tenantId!).then((data) => ({ data }));
  }

  @Post("room-types")
  @RequirePermissions("tenant.settings.write")
  createRoomType(@CurrentUser() user: AuthUser, @Body() body: RoomTypeDto) {
    return this.hotel.createRoomType(user.tenantId!, body).then((data) => ({ data }));
  }

  @Get("rooms")
  @RequirePermissions("sales.read")
  rooms(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return this.hotel.listRooms(user.tenantId!, branchId).then((data) => ({ data }));
  }

  @Post("rooms")
  @RequirePermissions("tenant.settings.write")
  createRoom(@CurrentUser() user: AuthUser, @Body() body: RoomDto) {
    return this.hotel.createRoom(user.tenantId!, body).then((data) => ({ data }));
  }

  @Patch("rooms/:id/status")
  @RequirePermissions("sales.create", "tenant.settings.write")
  roomStatus(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: StatusDto) {
    return this.hotel.setRoomStatus(user.tenantId!, id, body.status).then((data) => ({ data }));
  }

  @Get("reservations")
  @RequirePermissions("sales.read")
  reservations(@CurrentUser() user: AuthUser, @Query("status") status?: string) {
    return this.hotel.listReservations(user.tenantId!, status).then((data) => ({ data }));
  }

  @Post("reservations")
  @RequirePermissions("sales.create")
  createReservation(@CurrentUser() user: AuthUser, @Body() body: ReservationDto) {
    return this.hotel.createReservation(user.tenantId!, body).then((data) => ({ data }));
  }

  @Post("reservations/:id/check-in")
  @RequirePermissions("sales.create")
  checkIn(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: CheckInDto) {
    return this.hotel.checkIn(user.tenantId!, id, body.roomId, user.id).then((data) => ({ data }));
  }

  @Post("stays/:id/check-out")
  @RequirePermissions("sales.create")
  checkOut(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.hotel.checkOut(user.tenantId!, id, user.id).then((data) => ({ data }));
  }

  @Get("folios")
  @RequirePermissions("sales.read")
  folios(@CurrentUser() user: AuthUser, @Query("status") status?: string) {
    return this.hotel.listFolios(user.tenantId!, status).then((data) => ({ data }));
  }

  @Post("folios/:id/charges")
  @RequirePermissions("sales.create")
  postCharge(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: FolioPostDto) {
    return this.hotel
      .postSaleToFolio(user.tenantId!, id, body.saleId, user.id, body.description)
      .then((data) => ({ data }));
  }

  @Post("folios/:id/settle")
  @RequirePermissions("sales.create")
  settle(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: SettleDto) {
    return this.hotel.settleFolio(user.tenantId!, id, body, user.id).then((data) => ({ data }));
  }

  @Get("occupancy")
  @RequirePermissions("reports.read", "sales.read")
  occupancy(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return this.hotel.occupancy(user.tenantId!, branchId).then((data) => ({ data }));
  }
}
