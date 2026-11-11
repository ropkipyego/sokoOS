import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Public, RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";
import { BillingService } from "./billing.service";
import { EntitlementsService } from "./entitlements.service";
import { ForbiddenException } from "@nestjs/common";

class PlanDto {
  @IsString() @MinLength(2) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) priceMinor!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() interval?: string;
  @IsOptional() @IsInt() branchLimit?: number;
  @IsOptional() @IsInt() userLimit?: number;
  @IsOptional() @IsInt() deviceLimit?: number;
  @IsOptional() @IsObject() modulesAllowed?: Record<string, boolean>;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

class AssignDto {
  @IsString() planCode!: string;
  @IsOptional() @IsBoolean() activate?: boolean;
}

class StatusDto {
  @IsString() status!: string;
}

class ManualPayDto {
  @IsInt() @Min(1) amountMinor!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() confirm?: boolean;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Public()
  @Get("public/plans")
  publicPlans() {
    return this.billing.listPlans(true).then((data) => ({ data }));
  }

  @Get("platform/plans")
  @RequirePermissions("platform.billing.read", "platform.billing.manage", "platform.tenants.read")
  plans() {
    return this.billing.listPlans(false).then((data) => ({ data }));
  }

  @Post("platform/plans")
  @RequirePermissions("platform.billing.manage")
  upsertPlan(@Body() body: PlanDto) {
    return this.billing.upsertPlan(body).then((data) => ({ data }));
  }

  @Post("platform/plans/seed-defaults")
  @RequirePermissions("platform.billing.manage", "platform.tenants.manage")
  seed() {
    return this.billing.seedDefaultPlans().then((data) => ({ data }));
  }

  @Get("platform/subscriptions")
  @RequirePermissions("platform.billing.read", "platform.billing.manage", "platform.tenants.read")
  subscriptions() {
    return this.billing.listSubscriptions().then((data) => ({ data }));
  }

  @Post("platform/tenants/:tenantId/subscription")
  @RequirePermissions("platform.billing.manage", "platform.tenants.manage")
  assign(
    @CurrentUser() user: AuthUser,
    @Param("tenantId") tenantId: string,
    @Body() body: AssignDto,
  ) {
    return this.billing
      .assignSubscription(tenantId, body.planCode, user.id, { activate: body.activate })
      .then((data) => ({ data }));
  }

  @Post("platform/tenants/:tenantId/subscription/status")
  @RequirePermissions("platform.billing.manage", "platform.tenants.manage")
  status(
    @CurrentUser() user: AuthUser,
    @Param("tenantId") tenantId: string,
    @Body() body: StatusDto,
  ) {
    return this.billing
      .setSubscriptionStatus(tenantId, body.status, user.id)
      .then((data) => ({ data }));
  }

  @Post("platform/tenants/:tenantId/invoices")
  @RequirePermissions("platform.billing.manage")
  invoice(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string) {
    return this.billing.createInvoice(tenantId, user.id).then((data) => ({ data }));
  }

  @Post("platform/invoices/:invoiceId/manual-payment")
  @RequirePermissions("platform.billing.manage")
  pay(
    @CurrentUser() user: AuthUser,
    @Param("invoiceId") invoiceId: string,
    @Body() body: ManualPayDto,
  ) {
    return this.billing.recordManualPayment(invoiceId, user.id, body).then((data) => ({ data }));
  }

  @Get("platform/tenants/:tenantId/entitlements")
  @RequirePermissions("platform.billing.read", "platform.tenants.read")
  platformEntitlements(@Param("tenantId") tenantId: string) {
    return this.entitlements.snapshot(tenantId).then((data) => ({ data }));
  }

  @Get("entitlements/me")
  me(@CurrentUser() user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException({
        code: "TENANT_REQUIRED",
        message: "Tenant context required",
      });
    }
    return this.entitlements.snapshot(user.tenantId).then((data) => ({ data }));
  }
}
