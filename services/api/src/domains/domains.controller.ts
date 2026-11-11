import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";
import { DomainsService } from "./domains.service";

class CustomDomainDto {
  @IsString() @MinLength(3) hostname!: string;
}

class VerifyDto {
  @IsString() @MinLength(16) token!: string;
}

class StatusDto {
  @IsIn(["active", "suspended", "removed"]) status!: "active" | "suspended" | "removed";
}

@Controller("platform/domains")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @RequirePermissions("platform.domains.read", "platform.domains.manage", "platform.tenants.read")
  list(
    @Query("tenantId") tenantId?: string,
    @Query("q") q?: string,
  ) {
    return this.domains.listDomains({ tenantId, q }).then((data) => ({ data }));
  }

  @Get("reserved")
  @RequirePermissions("platform.domains.read", "platform.domains.manage", "platform.tenants.read")
  reserved() {
    return { data: this.domains.listReserved() };
  }

  @Get("history/:tenantId")
  @RequirePermissions("platform.domains.read", "platform.domains.manage", "platform.tenants.read")
  history(@Param("tenantId") tenantId: string) {
    return this.domains.domainHistory(tenantId).then((data) => ({ data }));
  }

  @Post("backfill")
  @RequirePermissions("platform.domains.manage", "platform.tenants.manage")
  backfill(@CurrentUser() user: AuthUser) {
    return this.domains.backfillAllPrimarySubdomains(user.id).then((data) => ({ data }));
  }

  @Post("tenants/:tenantId/primary")
  @RequirePermissions("platform.domains.manage", "platform.tenants.manage")
  ensurePrimary(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string) {
    return this.domains.ensurePrimarySubdomain(tenantId, user.id).then((data) => ({ data }));
  }

  @Post("tenants/:tenantId/custom")
  @RequirePermissions("platform.domains.manage", "platform.tenants.manage")
  custom(
    @CurrentUser() user: AuthUser,
    @Param("tenantId") tenantId: string,
    @Body() body: CustomDomainDto,
  ) {
    return this.domains.assignCustomDomain(tenantId, body.hostname, user.id).then((data) => ({
      data: {
        domain: data.domain,
        verificationToken: data.verificationToken,
        txtRecordHint: `_sokoos-verify.${body.hostname.toLowerCase()}`,
      },
    }));
  }

  @Post(":domainId/verify")
  @RequirePermissions("platform.domains.manage", "platform.tenants.manage")
  verify(
    @CurrentUser() user: AuthUser,
    @Param("domainId") domainId: string,
    @Body() body: VerifyDto,
  ) {
    return this.domains.verifyCustomDomain(domainId, body.token, user.id).then((data) => ({ data }));
  }

  @Post(":domainId/activate")
  @RequirePermissions("platform.domains.manage", "platform.tenants.manage")
  activate(@CurrentUser() user: AuthUser, @Param("domainId") domainId: string) {
    return this.domains.activateDomain(domainId, user.id).then((data) => ({ data }));
  }

  @Patch(":domainId/status")
  @RequirePermissions("platform.domains.manage", "platform.tenants.manage")
  status(
    @CurrentUser() user: AuthUser,
    @Param("domainId") domainId: string,
    @Body() body: StatusDto,
  ) {
    return this.domains.setDomainStatus(domainId, body.status, user.id).then((data) => ({ data }));
  }
}
