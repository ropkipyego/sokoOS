import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { RestaurantService } from "./restaurant.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

class RecipeLineDto {
  @IsUUID() ingredientProductId!: string;
  @IsNumber() @Min(0.0001) quantity!: number;
  @IsOptional() @IsString() unitLabel?: string;
}

class RecipeDto {
  @IsArray() lines!: RecipeLineDto[];
}

class ModifierDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() name!: string;
  @IsOptional() @IsInt() priceMinor?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}

class ModifierGroupDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() name!: string;
  @IsOptional() @IsInt() minSelect?: number;
  @IsOptional() @IsInt() maxSelect?: number;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsArray() modifiers?: ModifierDto[];
}

class StatusDto {
  @IsString() status!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RestaurantController {
  constructor(private readonly restaurant: RestaurantService) {}

  @Get("products/:productId/recipe")
  @RequirePermissions("products.read")
  recipe(@CurrentUser() user: AuthUser, @Param("productId") productId: string) {
    return this.restaurant.listRecipes(user.tenantId!, productId).then((data) => ({ data }));
  }

  @Put("products/:productId/recipe")
  @RequirePermissions("products.write")
  setRecipe(
    @CurrentUser() user: AuthUser,
    @Param("productId") productId: string,
    @Body() body: RecipeDto,
  ) {
    return this.restaurant.setRecipe(user.tenantId!, productId, body.lines ?? []).then((data) => ({ data }));
  }

  @Get("products/:productId/modifiers")
  @RequirePermissions("products.read")
  modifiers(@CurrentUser() user: AuthUser, @Param("productId") productId: string) {
    return this.restaurant.listModifierGroups(user.tenantId!, productId).then((data) => ({ data }));
  }

  @Post("products/:productId/modifiers")
  @RequirePermissions("products.write")
  upsertModifiers(
    @CurrentUser() user: AuthUser,
    @Param("productId") productId: string,
    @Body() body: ModifierGroupDto,
  ) {
    return this.restaurant.upsertModifierGroup(user.tenantId!, productId, body).then((data) => ({ data }));
  }

  @Get("kitchen/tickets")
  @RequirePermissions("sales.read")
  tickets(
    @CurrentUser() user: AuthUser,
    @Query() query: { branchId?: string; status?: string; departmentId?: string },
  ) {
    return this.restaurant.listKitchenTickets(user.tenantId!, query).then((data) => ({ data }));
  }

  @Patch("kitchen/tickets/:id")
  @RequirePermissions("sales.create")
  ticketStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: StatusDto,
  ) {
    return this.restaurant.updateTicketStatus(user.tenantId!, id, body.status).then((data) => ({ data }));
  }

  @Patch("kitchen/tickets/:ticketId/items/:itemId")
  @RequirePermissions("sales.create")
  ticketItemStatus(
    @CurrentUser() user: AuthUser,
    @Param("ticketId") ticketId: string,
    @Param("itemId") itemId: string,
    @Body() body: StatusDto,
  ) {
    return this.restaurant
      .updateTicketItemStatus(user.tenantId!, ticketId, itemId, body.status)
      .then((data) => ({ data }));
  }
}
