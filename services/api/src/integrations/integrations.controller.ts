import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { IntegrationsService } from "./integrations.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";
import { Public } from "../common/decorators/permissions.decorator";

class IntegrationsPatchDto {
  @IsOptional() mpesa?: Record<string, unknown>;
  @IsOptional() etims?: Record<string, unknown>;
  @IsOptional() printer?: Record<string, unknown>;
  @IsOptional() notifications?: Record<string, unknown>;
}

class StkDto {
  @IsUUID() saleId!: string;
  @IsString() @MinLength(9) phone!: string;
  @IsInt() @Min(1) amountMinor!: number;
}

class MpesaCallbackDto {
  @IsString() checkoutRequestId!: string;
  @IsOptional() @IsInt() resultCode?: number;
  @IsOptional() @IsString() mpesaReceiptNumber?: string;
  /** Set only by trusted internal verifier after signature checks — clients must not set this. */
  @IsOptional() @IsBoolean() trusted?: boolean;
}

class PrintDto {
  @IsUUID() saleId!: string;
  @IsOptional() @IsString() target?: string;
}

@Controller("integrations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get("health")
  @RequirePermissions("settings.manage", "tenant.settings.read")
  health(@CurrentUser() user: AuthUser) {
    return this.integrations.health(user.tenantId!).then((data) => ({ data }));
  }

  @Patch("settings")
  @RequirePermissions("settings.manage", "tenant.settings.write")
  update(@CurrentUser() user: AuthUser, @Body() body: IntegrationsPatchDto) {
    return this.integrations
      .updateSettings(user.tenantId!, user.id, body as never)
      .then((data) => ({ data }));
  }

  @Post("mpesa/stk")
  @RequirePermissions("sales.create")
  stk(@CurrentUser() user: AuthUser, @Body() body: StkDto) {
    return this.integrations.initiateMpesaStk(user.tenantId!, body).then((data) => ({ data }));
  }

  @Post("mpesa/callback")
  @Public()
  callback(@Body() body: MpesaCallbackDto & { tenantId?: string }) {
    // Public webhook — tenant resolved from payment reference in production; require explicit tenantId for now.
    if (!body.tenantId) {
      return { error: { code: "VALIDATION_FAILED", message: "tenantId required on callback envelope" } };
    }
    // Strip client-supplied trust — only internal verifier may set trusted=true after signature check.
    return this.integrations
      .handleMpesaCallback(body.tenantId, { ...body, trusted: false })
      .then((data) => ({ data }));
  }

  @Post("etims/sales/:saleId/submit")
  @RequirePermissions("sales.create")
  etims(@CurrentUser() user: AuthUser, @Param("saleId") saleId: string) {
    return this.integrations.submitEtimsInvoice(user.tenantId!, saleId).then((data) => ({ data }));
  }

  @Post("printer/jobs")
  @RequirePermissions("sales.create")
  print(@CurrentUser() user: AuthUser, @Body() body: PrintDto) {
    return this.integrations.enqueuePrintJob(user.tenantId!, body).then((data) => ({ data }));
  }
}
