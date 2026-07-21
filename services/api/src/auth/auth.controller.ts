import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { Public } from "../common/decorators/permissions.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;
}

@Controller("auth")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post("login")
  async login(@Body() body: LoginDto) {
    const data = await this.auth.login(body);
    return { data };
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() body: RefreshDto) {
    const data = await this.auth.refresh(body.refreshToken);
    return { data };
  }

  @Post("logout")
  async logout(@CurrentUser() user: AuthUser, @Body() body: LogoutDto) {
    const data = await this.auth.logout(user.id, body.refreshToken);
    return { data };
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    const data = await this.auth.me(user.id);
    return { data };
  }

  @Post("devices/register")
  @RequirePermissions("devices.write")
  async registerDevice(
    @CurrentUser() user: AuthUser,
    @Body() body: RegisterDeviceDto,
  ) {
    if (!user.tenantId) {
      return { data: null };
    }
    const data = await this.auth.registerDevice(user.tenantId, body);
    return { data };
  }
}
