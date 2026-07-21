import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Categories ---
  async listCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async createCategory(
    tenantId: string,
    input: { name: string; parentId?: string; sortOrder?: number },
    userId?: string,
  ) {
    return this.prisma.category.create({
      data: {
        tenantId,
        name: input.name,
        parentId: input.parentId,
        sortOrder: input.sortOrder ?? 0,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateCategory(
    tenantId: string,
    id: string,
    input: { name?: string; parentId?: string | null; sortOrder?: number; status?: string },
    userId?: string,
  ) {
    await this.requireCategory(tenantId, id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: input.name,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        status: input.status,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });
  }

  // --- Brands ---
  async listBrands(tenantId: string) {
    return this.prisma.brand.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async createBrand(tenantId: string, name: string, userId?: string) {
    try {
      return await this.prisma.brand.create({
        data: { tenantId, name, createdBy: userId, updatedBy: userId },
      });
    } catch {
      throw new ConflictException({ code: "CONFLICT", message: "Brand exists" });
    }
  }

  async updateBrand(
    tenantId: string,
    id: string,
    input: { name?: string; status?: string },
    userId?: string,
  ) {
    const brand = await this.prisma.brand.findFirst({ where: { id, tenantId } });
    if (!brand) throw new NotFoundException({ code: "NOT_FOUND", message: "Brand not found" });
    return this.prisma.brand.update({
      where: { id },
      data: { ...input, updatedBy: userId, version: { increment: 1 } },
    });
  }

  // --- Units ---
  async listUnits(tenantId: string) {
    return this.prisma.unit.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async createUnit(
    tenantId: string,
    input: { name: string; abbreviation: string },
    userId?: string,
  ) {
    try {
      return await this.prisma.unit.create({
        data: {
          tenantId,
          name: input.name,
          abbreviation: input.abbreviation,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    } catch {
      throw new ConflictException({ code: "CONFLICT", message: "Unit exists" });
    }
  }

  async updateUnit(
    tenantId: string,
    id: string,
    input: { name?: string; abbreviation?: string; status?: string },
    userId?: string,
  ) {
    const unit = await this.prisma.unit.findFirst({ where: { id, tenantId } });
    if (!unit) throw new NotFoundException({ code: "NOT_FOUND", message: "Unit not found" });
    return this.prisma.unit.update({
      where: { id },
      data: { ...input, updatedBy: userId, version: { increment: 1 } },
    });
  }

  // --- Products ---
  async listProducts(
    tenantId: string,
    opts: {
      limit?: number;
      cursor?: string;
      q?: string;
      sku?: string;
      barcode?: string;
      categoryId?: string;
      status?: string;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);

    const rows = await this.prisma.product.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(cursor ? { id: { gt: cursor.id } } : {}),
        ...(opts.sku ? { sku: opts.sku } : {}),
        ...(opts.barcode ? { barcode: opts.barcode } : {}),
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.q
          ? {
              OR: [
                { name: { contains: opts.q, mode: "insensitive" } },
                { sku: { contains: opts.q, mode: "insensitive" } },
                { barcode: { contains: opts.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { id: "asc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return {
      data,
      meta: paginateMeta(
        hasMore,
        limit,
        last ? encodeCursor({ id: last.id }) : null,
      ),
    };
  }

  async getProduct(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Product not found" });
    }
    return product;
  }

  async createProduct(
    tenantId: string,
    input: {
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
    userId?: string,
  ) {
    try {
      return await this.prisma.product.create({
        data: {
          id: input.id,
          tenantId,
          sku: input.sku,
          name: input.name,
          barcode: input.barcode,
          description: input.description,
          categoryId: input.categoryId,
          brandId: input.brandId,
          unitId: input.unitId,
          priceMinor: input.priceMinor,
          costMinor: input.costMinor,
          taxRateBps: input.taxRateBps ?? 0,
          trackInventory: input.trackInventory ?? true,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    } catch {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Product SKU already exists",
      });
    }
  }

  async updateProduct(
    tenantId: string,
    id: string,
    input: Partial<{
      name: string;
      barcode: string | null;
      description: string | null;
      categoryId: string | null;
      brandId: string | null;
      unitId: string | null;
      priceMinor: number;
      costMinor: number | null;
      taxRateBps: number;
      trackInventory: boolean;
      status: string;
      version: number;
    }>,
    userId?: string,
  ) {
    const existing = await this.getProduct(tenantId, id);
    if (input.version !== undefined && input.version !== existing.version) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Version conflict",
      });
    }
    const { version: _v, ...data } = input;
    return this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });
  }

  async archiveProduct(tenantId: string, id: string, userId?: string) {
    await this.getProduct(tenantId, id);
    return this.prisma.product.update({
      where: { id },
      data: {
        status: "archived",
        archivedAt: new Date(),
        updatedBy: userId,
        version: { increment: 1 },
      },
    });
  }

  private async requireCategory(tenantId: string, id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, tenantId } });
    if (!cat) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Category not found" });
    }
    return cat;
  }
}
