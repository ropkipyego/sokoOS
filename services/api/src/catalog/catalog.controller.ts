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
import { CatalogService } from "./catalog.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/tenant-context";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // Categories
  @Get("categories")
  @RequirePermissions("categories.read")
  async listCategories(@CurrentUser() user: AuthUser) {
    return { data: await this.catalog.listCategories(user.tenantId!) };
  }

  @Post("categories")
  @RequirePermissions("categories.write")
  async createCategory(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; parentId?: string; sortOrder?: number },
  ) {
    return {
      data: await this.catalog.createCategory(user.tenantId!, body, user.id),
    };
  }

  @Patch("categories/:id")
  @RequirePermissions("categories.write")
  async updateCategory(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      parentId?: string | null;
      sortOrder?: number;
      status?: string;
    },
  ) {
    return {
      data: await this.catalog.updateCategory(user.tenantId!, id, body, user.id),
    };
  }

  // Brands
  @Get("brands")
  @RequirePermissions("categories.read")
  async listBrands(@CurrentUser() user: AuthUser) {
    return { data: await this.catalog.listBrands(user.tenantId!) };
  }

  @Post("brands")
  @RequirePermissions("categories.write")
  async createBrand(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string },
  ) {
    return {
      data: await this.catalog.createBrand(user.tenantId!, body.name, user.id),
    };
  }

  @Patch("brands/:id")
  @RequirePermissions("categories.write")
  async updateBrand(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { name?: string; status?: string },
  ) {
    return {
      data: await this.catalog.updateBrand(user.tenantId!, id, body, user.id),
    };
  }

  // Units
  @Get("units")
  @RequirePermissions("categories.read")
  async listUnits(@CurrentUser() user: AuthUser) {
    return { data: await this.catalog.listUnits(user.tenantId!) };
  }

  @Post("units")
  @RequirePermissions("categories.write")
  async createUnit(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; abbreviation: string },
  ) {
    return {
      data: await this.catalog.createUnit(user.tenantId!, body, user.id),
    };
  }

  @Patch("units/:id")
  @RequirePermissions("categories.write")
  async updateUnit(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { name?: string; abbreviation?: string; status?: string },
  ) {
    return {
      data: await this.catalog.updateUnit(user.tenantId!, id, body, user.id),
    };
  }

  // Products
  @Get("products")
  @RequirePermissions("products.read")
  async listProducts(
    @CurrentUser() user: AuthUser,
    @Query()
    query: {
      limit?: string;
      cursor?: string;
      q?: string;
      sku?: string;
      barcode?: string;
      categoryId?: string;
      status?: string;
    },
  ) {
    return this.catalog.listProducts(user.tenantId!, {
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor,
      q: query.q,
      sku: query.sku,
      barcode: query.barcode,
      categoryId: query.categoryId,
      status: query.status,
    });
  }

  @Post("products")
  @RequirePermissions("products.write")
  async createProduct(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      id?: string;
      sku: string;
      name: string;
      barcode?: string;
      description?: string;
      categoryId?: string;
      brandId?: string;
      unitId?: string;
      priceMinor: number;
      costMinor?: number;
      taxRateBps?: number;
      trackInventory?: boolean;
    },
  ) {
    return {
      data: await this.catalog.createProduct(user.tenantId!, body, user.id),
    };
  }

  @Get("products/:id")
  @RequirePermissions("products.read")
  async getProduct(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return { data: await this.catalog.getProduct(user.tenantId!, id) };
  }

  @Patch("products/:id")
  @RequirePermissions("products.write")
  async updateProduct(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      barcode?: string | null;
      description?: string | null;
      categoryId?: string | null;
      brandId?: string | null;
      unitId?: string | null;
      priceMinor?: number;
      costMinor?: number | null;
      taxRateBps?: number;
      trackInventory?: boolean;
      status?: string;
      version?: number;
    },
  ) {
    return {
      data: await this.catalog.updateProduct(user.tenantId!, id, body, user.id),
    };
  }

  @Post("products/:id/archive")
  @RequirePermissions("products.write")
  async archiveProduct(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return {
      data: await this.catalog.archiveProduct(user.tenantId!, id, user.id),
    };
  }
}
