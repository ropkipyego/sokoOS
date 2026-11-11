import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Public, RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";
import { EmailService } from "./email.service";
import { InvitationsService } from "./invitations.service";

class AcceptInviteDto {
  @IsString() @MinLength(16) token!: string;
  @IsString() @MinLength(10) password!: string;
  @IsOptional() @IsString() name?: string;
}

class ResetRequestDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() tenantSlug?: string;
}

class ResetCompleteDto {
  @IsString() @MinLength(16) token!: string;
  @IsString() @MinLength(10) password!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailController {
  constructor(
    private readonly email: EmailService,
    private readonly invitations: InvitationsService,
  ) {}

  @Get("platform/email")
  @RequirePermissions("platform.email.read", "platform.email.manage", "platform.tenants.read")
  list(@Query("status") status?: string, @Query("q") q?: string) {
    return this.email.list({ status, q }).then((data) => ({ data }));
  }

  @Post("platform/email/process")
  @RequirePermissions("platform.email.manage", "platform.tenants.manage")
  process() {
    return this.email.processQueue(50).then((data) => ({ data }));
  }

  @Post("platform/invitations/:id/resend")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  resend(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invitations.resend(id, user.id).then((data) => ({ data }));
  }

  @Post("platform/invitations/:id/revoke")
  @RequirePermissions("platform.onboarding.manage", "platform.tenants.manage")
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invitations.revoke(id, user.id).then((data) => ({ data }));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Post("public/invitations/accept")
  accept(@Body() body: AcceptInviteDto) {
    return this.invitations
      .acceptInvitation(body.token, body.password, body.name)
      .then((data) => ({ data }));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post("public/password-reset/request")
  resetRequest(@Body() body: ResetRequestDto) {
    return this.invitations
      .requestPasswordReset(body.email, body.tenantSlug)
      .then((data) => ({ data }));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post("public/password-reset/complete")
  resetComplete(@Body() body: ResetCompleteDto) {
    return this.invitations
      .completePasswordReset(body.token, body.password)
      .then((data) => ({ data }));
  }
}
