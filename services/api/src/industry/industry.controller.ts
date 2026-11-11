import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { IndustryService } from "./industry.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class BatchDto {
  @IsUUID() productId!: string;
  @IsString() @MinLength(1) batchNumber!: string;
  @IsOptional() @IsString() expiryDate?: string;
  @IsOptional() @IsString() manufacturedAt?: string;
  @IsOptional() @IsInt() @Min(0) quantityOnHand?: number;
  @IsOptional() @IsString() notes?: string;
}

class AdjustDto {
  @IsInt() delta!: number;
}

class RxItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() dosage?: string;
  @IsOptional() @IsString() instructions?: string;
}

class PrescriptionDto {
  @IsString() @MinLength(1) patientName!: string;
  @IsOptional() @IsString() patientPhone?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsString() prescriber?: string;
  @IsOptional() @IsString() rxNumber?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() items!: RxItemDto[];
}

class DispenseDto {
  @IsOptional() @IsUUID() saleId?: string;
}

class PriceListDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) name!: string;
}

class PriceItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(0) priceMinor!: number;
  @IsOptional() @IsInt() @Min(1) minQuantity?: number;
}

class AssignPriceListDto {
  @IsOptional() @IsUUID() priceListId?: string | null;
}

class ServiceJobDto {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsString() dueAt?: string;
}

class StatusDto {
  @IsString() status!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IndustryController {
  constructor(private readonly industry: IndustryService) {}

  @Get("pharmacy/batches")
  @RequirePermissions("inventory.read", "products.read")
  batches(
    @CurrentUser() user: AuthUser,
    @Query("productId") productId?: string,
    @Query("expiringWithinDays") expiringWithinDays?: string,
  ) {
    return this.industry
      .listBatches(
        user.tenantId!,
        productId,
        expiringWithinDays ? Number(expiringWithinDays) : undefined,
      )
      .then((data) => ({ data }));
  }

  @Post("pharmacy/batches")
  @RequirePermissions("inventory.adjust", "products.write")
  createBatch(@CurrentUser() user: AuthUser, @Body() body: BatchDto) {
    return this.industry.createBatch(user.tenantId!, body).then((data) => ({ data }));
  }

  @Post("pharmacy/batches/:id/adjust")
  @RequirePermissions("inventory.adjust")
  adjust(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: AdjustDto) {
    return this.industry.adjustBatchQty(user.tenantId!, id, body.delta).then((data) => ({ data }));
  }

  @Get("pharmacy/prescriptions")
  @RequirePermissions("sales.read")
  prescriptions(@CurrentUser() user: AuthUser, @Query("status") status?: string) {
    return this.industry.listPrescriptions(user.tenantId!, status).then((data) => ({ data }));
  }

  @Post("pharmacy/prescriptions")
  @RequirePermissions("sales.create")
  createRx(@CurrentUser() user: AuthUser, @Body() body: PrescriptionDto) {
    return this.industry.createPrescription(user.tenantId!, user.id, body).then((data) => ({ data }));
  }

  @Post("pharmacy/prescriptions/:id/dispense")
  @RequirePermissions("sales.create")
  dispense(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: DispenseDto) {
    return this.industry.dispensePrescription(user.tenantId!, id, body.saleId).then((data) => ({ data }));
  }

  @Get("wholesale/price-lists")
  @RequirePermissions("products.read", "customers.read")
  priceLists(@CurrentUser() user: AuthUser) {
    return this.industry.listPriceLists(user.tenantId!).then((data) => ({ data }));
  }

  @Post("wholesale/price-lists")
  @RequirePermissions("products.write")
  createList(@CurrentUser() user: AuthUser, @Body() body: PriceListDto) {
    return this.industry.createPriceList(user.tenantId!, body).then((data) => ({ data }));
  }

  @Get("wholesale/price-lists/:id/items")
  @RequirePermissions("products.read")
  listItems(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.industry.listPriceListItems(user.tenantId!, id).then((data) => ({ data }));
  }

  @Post("wholesale/price-lists/:id/items")
  @RequirePermissions("products.write")
  upsertItem(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: PriceItemDto) {
    return this.industry.upsertPriceListItem(user.tenantId!, id, body).then((data) => ({ data }));
  }

  @Patch("wholesale/customers/:customerId/price-list")
  @RequirePermissions("customers.write")
  assignList(
    @CurrentUser() user: AuthUser,
    @Param("customerId") customerId: string,
    @Body() body: AssignPriceListDto,
  ) {
    return this.industry
      .assignCustomerPriceList(user.tenantId!, customerId, body.priceListId ?? null)
      .then((data) => ({ data }));
  }

  @Get("services/jobs")
  @RequirePermissions("sales.read")
  jobs(@CurrentUser() user: AuthUser, @Query("status") status?: string) {
    return this.industry.listServiceJobs(user.tenantId!, status).then((data) => ({ data }));
  }

  @Post("services/jobs")
  @RequirePermissions("sales.create")
  createJob(@CurrentUser() user: AuthUser, @Body() body: ServiceJobDto) {
    return this.industry.createServiceJob(user.tenantId!, user.id, body).then((data) => ({ data }));
  }

  @Patch("services/jobs/:id")
  @RequirePermissions("sales.create")
  jobStatus(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: StatusDto) {
    return this.industry.updateServiceJobStatus(user.tenantId!, id, body.status).then((data) => ({ data }));
  }
}
