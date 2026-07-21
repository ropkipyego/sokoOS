import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { ExpensesService } from "./expenses.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class CreateExpenseDto {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(1) category!: string;
  @IsInt() @Min(1) amountMinor!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() occurredAt?: string;
}

@Controller("expenses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermissions("expenses.read")
  async list(
    @CurrentUser() user: AuthUser,
    @Query()
    query: {
      limit?: string;
      cursor?: string;
      branchId?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.expenses.list(user.tenantId!, {
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor,
      branchId: query.branchId,
      from: query.from,
      to: query.to,
    });
  }

  @Post()
  @RequirePermissions("expenses.write")
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateExpenseDto) {
    return { data: await this.expenses.create(user.tenantId!, body, user.id) };
  }

  @Get(":id")
  @RequirePermissions("expenses.read")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return { data: await this.expenses.get(user.tenantId!, id) };
  }

  @Patch(":id")
  @RequirePermissions("expenses.write")
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: Partial<CreateExpenseDto>,
  ) {
    return { data: await this.expenses.update(user.tenantId!, id, body, user.id) };
  }
}
