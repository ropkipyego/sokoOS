import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { SyncService } from "./sync.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class PullDto {
  @IsInt() @Min(0) serverSeq!: number;
  @IsOptional() @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) entityTypes?: string[];
  @IsOptional() @IsUUID() deviceId?: string;
}

@Controller("sync")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post("push")
  async push(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const data = await this.sync.push(user.tenantId!, user.id, body);
    return { data };
  }

  @Post("pull")
  async pull(@CurrentUser() user: AuthUser, @Body() body: PullDto) {
    const deviceId = body.deviceId ?? user.deviceId;
    if (!deviceId) {
      return {
        data: { changes: [], serverSeq: body.serverSeq, hasMore: false },
      };
    }
    const data = await this.sync.pull(user.tenantId!, deviceId, body);
    return { data };
  }

  @Get("status")
  async status(@CurrentUser() user: AuthUser) {
    if (!user.deviceId) {
      return { data: { status: "no_device" } };
    }
    const data = await this.sync.status(user.tenantId!, user.deviceId);
    return { data };
  }

  @Get("devices/:id/status")
  async deviceStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    const data = await this.sync.status(user.tenantId!, id);
    return { data };
  }
}
