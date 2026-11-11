import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MediaService } from "../media/media.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

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
      featured?: boolean;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 500);
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
        ...(opts.featured ? { featured: true } : {}),
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
      include: { category: { select: { id: true, name: true } } },
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
      itemType?: string;
      featured?: boolean;
      minStockQty?: number;
      imageUrl?: string;
      thumbnailUrl?: string;
    },
    userId?: string,
  ) {
    const itemType = input.itemType ?? "stock";
    const trackInventory =
      input.trackInventory ??
      !["prepared", "service", "accommodation", "non_stock"].includes(itemType);
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
          trackInventory,
          itemType,
          featured: input.featured ?? false,
          minStockQty: input.minStockQty ?? 0,
          imageUrl: input.imageUrl,
          thumbnailUrl: input.thumbnailUrl ?? input.imageUrl,
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
      itemType: string;
      featured: boolean;
      minStockQty: number;
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

  async setImage(
    tenantId: string,
    id: string,
    file: { mimetype: string; size: number; buffer: Buffer; originalname: string },
    userId?: string,
  ) {
    const product = await this.getProduct(tenantId, id);
    await this.media.removeFile(product.imageUrl);
    const saved = await this.media.saveProductImage(tenantId, id, file);
    return this.prisma.product.update({
      where: { id },
      data: {
        imageUrl: saved.imageUrl,
        thumbnailUrl: saved.thumbnailUrl,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });
  }

  async clearImage(tenantId: string, id: string, userId?: string) {
    const product = await this.getProduct(tenantId, id);
    await this.media.removeFile(product.imageUrl);
    return this.prisma.product.update({
      where: { id },
      data: {
        imageUrl: null,
        thumbnailUrl: null,
        updatedBy: userId,
        version: { increment: 1 },
      },
    });
  }

  /**
   * Money columns:
   * - `price` / `cost` = major units (e.g. 1250.00 KES) → converted to minor
   * - `priceMinor` / `costMinor` = integer cents/cents already
   * Images:
   * - optional `imageUrl` public https URL (no binary in CSV)
   * - local files: upload after create / per-product in the UI
   */
  async importProducts(
    tenantId: string,
    rows: Array<Record<string, string>>,
    userId?: string,
  ) {
    const accepted: string[] = [];
    const rejected: Array<{ row: number; sku?: string; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? {};
      const sku = (row.sku ?? row.SKU ?? "").trim();
      const name = (row.name ?? row.Name ?? "").trim();
      const priceMinor = this.parseMoneyCell(row, ["priceMinor", "price", "selling_price", "sellingPrice"]);
      if (!sku || !name) {
        rejected.push({ row: i + 1, sku, error: "sku and name are required" });
        continue;
      }
      if (priceMinor === null || priceMinor < 0) {
        rejected.push({
          row: i + 1,
          sku,
          error: "invalid price — use price (e.g. 1250.00) or priceMinor (e.g. 125000)",
        });
        continue;
      }
      const barcode = (row.barcode ?? row.Barcode ?? "").trim() || undefined;
      const costMinor = this.parseMoneyCell(row, ["costMinor", "cost", "buying_price", "buyingPrice"]);
      const imageUrl = (row.imageUrl ?? row.image_url ?? row.ImageUrl ?? "").trim() || undefined;
      if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
        rejected.push({ row: i + 1, sku, error: "imageUrl must be an http(s) URL" });
        continue;
      }
      try {
        const existing = await this.prisma.product.findFirst({ where: { tenantId, sku } });
        if (existing) {
          rejected.push({ row: i + 1, sku, error: "duplicate SKU" });
          continue;
        }
        await this.createProduct(
          tenantId,
          {
            sku,
            name,
            barcode,
            priceMinor,
            costMinor: costMinor ?? undefined,
            minStockQty: row.minStockQty || row.min_stock ? Number(row.minStockQty ?? row.min_stock) : 0,
            featured: ["1", "true", "yes"].includes((row.featured ?? "").toLowerCase()),
            imageUrl,
            thumbnailUrl: imageUrl,
          },
          userId,
        );
        accepted.push(sku);
      } catch (err) {
        rejected.push({
          row: i + 1,
          sku,
          error: err instanceof Error ? err.message : "import failed",
        });
      }
    }

    if (!rows.length) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "No rows to import",
      });
    }

    return {
      accepted: accepted.length,
      rejected: rejected.length,
      errors: rejected,
    };
  }

  async exportCsv(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { sku: "asc" },
    });
    const header = "sku,name,barcode,price,cost,minStockQty,featured,imageUrl,status";
    const lines = products.map((p) =>
      [
        this.csvEscape(p.sku),
        this.csvEscape(p.name),
        p.barcode ?? "",
        (p.priceMinor / 100).toFixed(2),
        p.costMinor != null ? (p.costMinor / 100).toFixed(2) : "",
        p.minStockQty,
        p.featured ? "true" : "false",
        p.imageUrl ?? "",
        p.status,
      ].join(","),
    );
    return `${header}\n${lines.join("\n")}\n`;
  }

  private parseMoneyCell(row: Record<string, string>, keys: string[]): number | null {
    for (const key of keys) {
      const raw = row[key];
      if (raw === undefined || raw === "") continue;
      const n = Number(String(raw).replace(/,/g, "").trim());
      if (!Number.isFinite(n) || n < 0) return null;
      // priceMinor / costMinor stay as integer minor units; other keys are major units
      if (key.toLowerCase().includes("minor")) return Math.round(n);
      return Math.round(n * 100);
    }
    return null;
  }

  private csvEscape(value: string) {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
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
