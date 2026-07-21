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
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ReturnsService } from "./returns.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class ReturnItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsInt() @Min(0) unitPriceMinor?: number;
}

class CreateReturnDto {
  @IsOptional() @IsUUID() id?: string;
  @IsUUID() saleId!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsString() @MinLength(1) reason?: string;
  @IsOptional() @IsString() occurredAt?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];
}

@Controller("returns")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @RequirePermissions("returns.read")
  async list(
    @CurrentUser() user: AuthUser,
    @Query()
    query: {
      branchId?: string;
      saleId?: string;
      limit?: string;
      cursor?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.returns.list(user.tenantId!, {
      branchId: query.branchId,
      saleId: query.saleId,
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor,
      from: query.from,
      to: query.to,
    });
  }

  @Post()
  @RequirePermissions("returns.create")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateReturnDto) {
    const data = await this.returns.create(user.tenantId!, user.id, body);
    return { data };
  }

  @Get(":id")
  @RequirePermissions("returns.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return { data: await this.returns.get(user.tenantId!, id) };
  }
}
