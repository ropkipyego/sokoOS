import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
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
      featured?: string;
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
      featured: query.featured === "true",
    });
  }

  @Get("products/export.csv")
  @RequirePermissions("products.read")
  @Header("Content-Type", "text/csv")
  async exportCsv(@CurrentUser() user: AuthUser) {
    return this.catalog.exportCsv(user.tenantId!);
  }

  @Get("products/import-template.csv")
  @RequirePermissions("products.import")
  @Header("Content-Type", "text/csv")
  importTemplate() {
    return [
      "sku,name,barcode,price,cost,minStockQty,featured,imageUrl",
      "RICE-5KG,Premium Rice 5kg,6001234567890,1250.00,980.00,5,true,",
      "OIL-2L,Cooking Oil 2L,6001234567891,890.00,720.00,8,false,https://example.com/oil.jpg",
      "",
    ].join("\n");
  }

  @Post("products/import")
  @RequirePermissions("products.import")
  async importProducts(
    @CurrentUser() user: AuthUser,
    @Body() body: { rows: Array<Record<string, string>> },
  ) {
    return { data: await this.catalog.importProducts(user.tenantId!, body.rows ?? [], user.id) };
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
      featured?: boolean;
      minStockQty?: number;
      imageUrl?: string;
      thumbnailUrl?: string;
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
      featured?: boolean;
      minStockQty?: number;
      status?: string;
      version?: number;
    },
  ) {
    return {
      data: await this.catalog.updateProduct(user.tenantId!, id, body, user.id),
    };
  }

  @Post("products/:id/image")
  @RequirePermissions("products.write")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 2_000_000 } }))
  async uploadImage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      return { error: { code: "VALIDATION_FAILED", message: "file is required" } };
    }
    return {
      data: await this.catalog.setImage(user.tenantId!, id, file, user.id),
    };
  }

  @Delete("products/:id/image")
  @RequirePermissions("products.write")
  async clearImage(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return { data: await this.catalog.clearImage(user.tenantId!, id, user.id) };
  }

  @Post("products/:id/archive")
  @RequirePermissions("products.write")
  async archiveProduct(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return {
      data: await this.catalog.archiveProduct(user.tenantId!, id, user.id),
    };
  }
}
