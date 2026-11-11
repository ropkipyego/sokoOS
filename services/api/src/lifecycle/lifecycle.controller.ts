import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsArray,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Public, RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";
import { RegistrationService } from "./registration.service";
import { ProvisioningService } from "./provisioning.service";
import { LifecycleService } from "./lifecycle.service";
import type { BusinessType, ModulesEnabled } from "@sokoos/types";

class RegisterDto {
  @IsString() @MinLength(2) businessName!: string;
  @IsOptional() @IsString() legalName?: string;
  @IsString() @MinLength(2) contactName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() businessSize?: string;
  @IsOptional() @IsArray() requestedModules?: string[];
  @IsString() @MinLength(2) preferredSlug!: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

class VerifyEmailDto {
  @IsString() @MinLength(16) token!: string;
}

class ReviewDto {
  @IsIn(["approve", "reject", "request_info"]) action!: "approve" | "reject" | "request_info";
  @IsOptional() @IsString() notes?: string;
}

class NotesDto {
  @IsOptional() @IsString() notes?: string;
}

class PlatformCreateClientDto {
  @IsString() @MinLength(2) businessName!: string;
  @IsOptional() @IsString() legalName?: string;
  @IsString() @MinLength(2) slug!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsArray() businessTypes?: string[];
  @IsOptional() @IsObject() modulesEnabled?: Record<string, boolean>;
  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @IsString() branchCode?: string;
  @IsOptional() @IsArray() departments?: Array<{ code: string; name: string; type: string }>;
  @IsString() @MinLength(2) adminName!: string;
  @IsEmail() adminEmail!: string;
  @IsOptional() @IsString() adminPhone?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

class StatusDto {
  @IsIn([
    "active",
    "suspended",
    "deactivated",
    "invitation_pending",
    "provisioning",
    "provisioning_failed",
  ])
  status!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LifecycleController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly provisioning: ProvisioningService,
    private readonly lifecycle: LifecycleService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Post("public/registrations")
  submit(@Body() body: RegisterDto) {
    return this.registration.submit(body).then((data) => ({ data }));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 900_000 } })
  @Post("public/registrations/:id/verify-email")
  verify(@Param("id") id: string, @Body() body: VerifyEmailDto) {
    return this.registration.verifyEmail(id, body.token).then((data) => ({ data }));
  }

  @Get("platform/registrations")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage", "platform.tenants.read")
  list(@Query("status") status?: string) {
    return this.registration.list(status).then((data) => ({ data }));
  }

  @Get("platform/registrations/:id")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage", "platform.tenants.read")
  get(@Param("id") id: string) {
    return this.registration.get(id).then((data) => ({ data }));
  }

  @Post("platform/registrations/:id/review")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  review(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: ReviewDto,
  ) {
    return this.registration.review(id, body.action, user.id, body.notes).then((data) => ({ data }));
  }

  @Post("platform/registrations/:id/provision")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  provisionReg(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: NotesDto,
  ) {
    return this.registration
      .approveAndProvision(id, user.id, body.notes)
      .then((data) => ({ data }));
  }

  @Post("platform/clients")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  createClient(@CurrentUser() user: AuthUser, @Body() body: PlatformCreateClientDto) {
    return this.provisioning
      .provision({
        idempotencyKey:
          body.idempotencyKey?.trim() || `platform-create:${body.slug}:${body.adminEmail}`,
        businessName: body.businessName,
        legalName: body.legalName,
        slug: body.slug,
        email: body.email,
        phone: body.phone,
        country: body.country,
        currency: body.currency,
        timezone: body.timezone,
        businessTypes: body.businessTypes as BusinessType[] | undefined,
        modulesEnabled: body.modulesEnabled as ModulesEnabled | undefined,
        branchName: body.branchName,
        branchCode: body.branchCode,
        departments: body.departments,
        adminName: body.adminName,
        adminEmail: body.adminEmail,
        adminPhone: body.adminPhone,
        actorUserId: user.id,
        initialStatus: "invitation_pending",
      })
      .then((data) => ({ data }));
  }

  @Post("platform/tenants/:tenantId/retry-provision")
  @RequirePermissions("platform.tenants.manage")
  retry(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string) {
    return this.provisioning.retryFailedTenant(tenantId, user.id).then((data) => ({ data }));
  }

  @Post("platform/tenants/:tenantId/lifecycle")
  @RequirePermissions("platform.tenants.manage")
  setLifecycle(
    @CurrentUser() user: AuthUser,
    @Param("tenantId") tenantId: string,
    @Body() body: StatusDto,
  ) {
    return this.lifecycle
      .setTenantLifecycle(tenantId, body.status, user.id)
      .then((data) => ({ data }));
  }
}
