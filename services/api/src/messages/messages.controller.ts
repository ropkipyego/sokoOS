import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { MessagesService } from "./messages.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class CreateMessageDto {
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsString() audience?: string;
  @IsOptional() @IsUUID() branchId?: string;
}

@Controller("messages")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @RequirePermissions("messages.read")
  async list(@CurrentUser() user: AuthUser) {
    return { data: await this.messages.list(user.tenantId!, user.id) };
  }

  @Post()
  @RequirePermissions("messages.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateMessageDto) {
    return { data: await this.messages.create(user.tenantId!, user.id, body) };
  }

  @Post(":id/read")
  @RequirePermissions("messages.read")
  async read(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return { data: await this.messages.markRead(user.tenantId!, id, user.id) };
  }
}
