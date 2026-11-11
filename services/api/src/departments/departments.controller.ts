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
import { IsInt, IsObject, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { DepartmentsService } from "./departments.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class CreateDeptDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsObject() settings?: object;
}

class UpdateDeptDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() branchId?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsObject() settings?: object;
}

class MemberDto {
  @IsUUID() userId!: string;
}

class DeviceDto {
  @IsUUID() deviceId!: string;
}

@Controller("departments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermissions("departments.read", "tenant.settings.read")
  list(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return this.departments.list(user.tenantId!, branchId).then((data) => ({ data }));
  }

  @Get(":id")
  @RequirePermissions("departments.read", "tenant.settings.read")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.departments.get(user.tenantId!, id).then((data) => ({ data }));
  }

  @Post()
  @RequirePermissions("departments.write", "tenant.settings.write")
  create(@CurrentUser() user: AuthUser, @Body() body: CreateDeptDto) {
    return this.departments.create(user.tenantId!, body, user.id).then((data) => ({ data }));
  }

  @Patch(":id")
  @RequirePermissions("departments.write", "tenant.settings.write")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: UpdateDeptDto) {
    return this.departments.update(user.tenantId!, id, body, user.id).then((data) => ({ data }));
  }

  @Post(":id/members")
  @RequirePermissions("departments.write", "users.write")
  addMember(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: MemberDto) {
    return this.departments.addMember(user.tenantId!, id, body.userId).then((data) => ({ data }));
  }

  @Delete(":id/members/:userId")
  @RequirePermissions("departments.write", "users.write")
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    return this.departments.removeMember(user.tenantId!, id, userId).then((data) => ({ data }));
  }

  @Post(":id/devices")
  @RequirePermissions("departments.write", "devices.write")
  assignDevice(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: DeviceDto) {
    return this.departments.assignDevice(user.tenantId!, id, body.deviceId).then((data) => ({ data }));
  }

  @Delete(":id/devices/:deviceId")
  @RequirePermissions("departments.write", "devices.write")
  unassignDevice(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("deviceId") deviceId: string,
  ) {
    return this.departments.unassignDevice(user.tenantId!, id, deviceId).then((data) => ({ data }));
  }

  @Get(":id/products")
  @RequirePermissions("departments.read", "products.read")
  listProducts(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.departments.listProducts(user.tenantId!, id).then((data) => ({ data }));
  }

  @Post(":id/products")
  @RequirePermissions("departments.write", "products.write")
  offerProduct(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { productId: string; priceMinor?: number | null; available?: boolean; sortOrder?: number },
  ) {
    return this.departments.offerProduct(user.tenantId!, id, body).then((data) => ({ data }));
  }

  @Delete(":id/products/:productId")
  @RequirePermissions("departments.write", "products.write")
  removeProduct(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("productId") productId: string,
  ) {
    return this.departments.removeProduct(user.tenantId!, id, productId).then((data) => ({ data }));
  }
}
