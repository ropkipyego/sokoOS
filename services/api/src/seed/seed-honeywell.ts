/**
 * Honeywell demo tenant: hybrid retail + restaurant, tables, imaged products.
 * Additive — does not wipe demo tenant.
 *
 * Usage: pnpm --filter @sokoos/api exec tsx src/seed/seed-honeywell.ts
 */
import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import * as bcrypt from "bcryptjs";
import { createPrismaClient } from "@sokoos/database";
import { CORE_PERMISSION_KEYS } from "@sokoos/types";
import { SystemRole } from "@sokoos/shared";
import { ROLE_PERMISSION_TEMPLATES } from "../roles/roles.service";

const prisma = createPrismaClient(process.env.DATABASE_URL);
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_ROOT ?? path.join(process.cwd(), "uploads"));

async function upsertPermission(key: string) {
  return prisma.permission.upsert({
    where: { key },
    create: { key, description: key, category: key.split(".")[0] ?? "core" },
    update: {},
  });
}

async function ensureRole(
  tenantId: string | null,
  key: string,
  name: string,
  permissionKeys: readonly string[],
) {
  let role = await prisma.role.findFirst({ where: { tenantId, key } });
  if (!role) role = await prisma.role.create({ data: { tenantId, key, name, isSystem: true } });
  const permissions = await prisma.permission.findMany({ where: { key: { in: [...permissionKeys] } } });
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
  }
  return role;
}

function mediaUrl(tenantId: string, productId: string, slug: string) {
  const dir = path.join(UPLOAD_ROOT, tenantId, "products");
  mkdirSync(dir, { recursive: true });
  const sample = path.join(UPLOAD_ROOT, "samples", `${slug}.png`);
  if (!existsSync(sample)) return { imageUrl: null as string | null, thumbnailUrl: null as string | null };
  const file = `${productId}-${slug}.png`;
  const thumb = `${productId}-${slug}.thumb.png`;
  copyFileSync(sample, path.join(dir, file));
  copyFileSync(sample, path.join(dir, thumb));
  return {
    imageUrl: `/v1/media/${tenantId}/products/${file}`,
    thumbnailUrl: `/v1/media/${tenantId}/products/${thumb}`,
  };
}

async function main() {
  console.log("Seeding Honeywell tenant…");

  for (const key of CORE_PERMISSION_KEYS) await upsertPermission(key);

  // Generate sample PNGs once
  const gen = path.join(process.cwd(), "src/seed/generate-sample-images.py");
  mkdirSync(path.join(UPLOAD_ROOT, "samples"), { recursive: true });
  execFileSync("python3", [gen, path.join(UPLOAD_ROOT, "samples")], { stdio: "inherit" });

  let tenant = await prisma.tenant.findUnique({ where: { slug: "honeywell" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Honeywell Commerce",
        slug: "honeywell",
        currency: "KES",
        timezone: "Africa/Nairobi",
        locale: "en-KE",
        status: "active",
        settings: {
          negativeStockPolicy: "block",
          businessMode: "hybrid",
          restaurantEnabled: true,
          company: {
            legalName: "Honeywell Commerce Ltd",
            phone: "+254700000120",
            email: "ops@honeywell.demo",
            address: "Industrial Area, Nairobi",
          },
        },
      },
    });
    console.log("Created tenant honeywell");
  } else {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        settings: {
          ...(typeof tenant.settings === "object" && tenant.settings ? (tenant.settings as object) : {}),
          businessMode: "hybrid",
          restaurantEnabled: true,
          company: {
            legalName: "Honeywell Commerce Ltd",
            phone: "+254700000120",
            email: "ops@honeywell.demo",
            address: "Industrial Area, Nairobi",
          },
        },
      },
    });
    console.log("Updated tenant honeywell settings");
  }

  await prisma.authzVersion.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, version: 1 },
    update: {},
  });

  let branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, code: "HW-MAIN" } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: "Honeywell Flagship",
        code: "HW-MAIN",
        status: "active",
        settings: { floor: "restaurant+retail" },
      },
    });
  }

  const ownerPerms =
    ROLE_PERMISSION_TEMPLATES[SystemRole.BusinessOwner] ??
    CORE_PERMISSION_KEYS.filter((k) => !k.startsWith("platform."));
  const ownerRole = await ensureRole(tenant.id, SystemRole.BusinessOwner, "Business Owner", ownerPerms);
  const cashierRole = await ensureRole(
    tenant.id,
    SystemRole.Cashier,
    "Cashier",
    ROLE_PERMISSION_TEMPLATES[SystemRole.Cashier] ?? ["products.read", "sales.create", "sales.read", "inventory.read", "categories.read"],
  );

  const passwordHash = await bcrypt.hash("Honeywell123!", 12);
  let user = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: "owner@honeywell.demo" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "owner@honeywell.demo",
        name: "Honeywell Owner",
        passwordHash,
        status: "active",
      },
    });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  }

  for (const binding of [
    { roleId: ownerRole.id, branchId: null as string | null },
    { roleId: cashierRole.id, branchId: branch.id },
  ]) {
    const exists = await prisma.userRole.findFirst({
      where: { tenantId: tenant.id, userId: user.id, roleId: binding.roleId, branchId: binding.branchId },
    });
    if (!exists) {
      await prisma.userRole.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: binding.roleId, branchId: binding.branchId },
      });
    }
  }

  let warehouse = await prisma.warehouse.findFirst({
    where: { tenantId: tenant.id, branchId: branch.id, isDefault: true },
  });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: "Main Floor",
        isDefault: true,
        status: "active",
      },
    });
  }

  let unit = await prisma.unit.findFirst({ where: { tenantId: tenant.id, abbreviation: "pcs" } });
  if (!unit) {
    unit = await prisma.unit.create({
      data: { tenantId: tenant.id, name: "Piece", abbreviation: "pcs" },
    });
  }

  async function category(name: string, sortOrder: number) {
    let c = await prisma.category.findFirst({ where: { tenantId: tenant!.id, name } });
    if (!c) c = await prisma.category.create({ data: { tenantId: tenant!.id, name, sortOrder } });
    return c;
  }

  const catRetail = await category("Retail", 0);
  const catKitchen = await category("Kitchen", 1);
  const catDrinks = await category("Drinks", 2);
  const catHardware = await category("Hardware", 3);

  const products: Array<{
    sku: string;
    name: string;
    barcode: string;
    priceMinor: number;
    costMinor: number;
    featured: boolean;
    categoryId: string;
    imageSlug: string;
    trackInventory: boolean;
  }> = [
    { sku: "HW-SUGAR-1KG", name: "Sugar 1kg", barcode: "8901100123456", priceMinor: 25000, costMinor: 18000, featured: true, categoryId: catRetail.id, imageSlug: "sugar", trackInventory: true },
    { sku: "HW-RICE-2KG", name: "Rice 2kg", barcode: "8901100123457", priceMinor: 35000, costMinor: 28000, featured: true, categoryId: catRetail.id, imageSlug: "rice", trackInventory: true },
    { sku: "HW-OIL-1L", name: "Cooking Oil 1L", barcode: "8901100123458", priceMinor: 42000, costMinor: 35000, featured: false, categoryId: catRetail.id, imageSlug: "oil", trackInventory: true },
    { sku: "HW-BURGER", name: "HW Classic Burger", barcode: "8902200123451", priceMinor: 65000, costMinor: 28000, featured: true, categoryId: catKitchen.id, imageSlug: "burger", trackInventory: false },
    { sku: "HW-FRIES", name: "Crispy Fries", barcode: "8902200123452", priceMinor: 25000, costMinor: 8000, featured: true, categoryId: catKitchen.id, imageSlug: "fries", trackInventory: false },
    { sku: "HW-PIZZA", name: "Margherita Pizza", barcode: "8902200123453", priceMinor: 95000, costMinor: 40000, featured: true, categoryId: catKitchen.id, imageSlug: "pizza", trackInventory: false },
    { sku: "HW-CHICKEN", name: "Grilled Chicken", barcode: "8902200123454", priceMinor: 78000, costMinor: 35000, featured: false, categoryId: catKitchen.id, imageSlug: "chicken", trackInventory: false },
    { sku: "HW-SALAD", name: "Garden Salad", barcode: "8902200123455", priceMinor: 45000, costMinor: 15000, featured: false, categoryId: catKitchen.id, imageSlug: "salad", trackInventory: false },
    { sku: "HW-SODA", name: "Soda 500ml", barcode: "8903300123451", priceMinor: 12000, costMinor: 6000, featured: true, categoryId: catDrinks.id, imageSlug: "soda", trackInventory: true },
    { sku: "HW-COFFEE", name: "Americano", barcode: "8903300123452", priceMinor: 25000, costMinor: 5000, featured: true, categoryId: catDrinks.id, imageSlug: "coffee", trackInventory: false },
    { sku: "HW-VOYAGER", name: "Voyager 1200g Scanner", barcode: "8904400123451", priceMinor: 1850000, costMinor: 1200000, featured: true, categoryId: catHardware.id, imageSlug: "scanner", trackInventory: true },
    { sku: "HW-PRINTER", name: "Thermal Receipt Printer", barcode: "8904400123452", priceMinor: 1250000, costMinor: 800000, featured: false, categoryId: catHardware.id, imageSlug: "printer", trackInventory: true },
  ];

  for (const sample of products) {
    let product = await prisma.product.findFirst({ where: { tenantId: tenant.id, sku: sample.sku } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          sku: sample.sku,
          name: sample.name,
          barcode: sample.barcode,
          featured: sample.featured,
          minStockQty: sample.trackInventory ? 5 : 0,
          priceMinor: sample.priceMinor,
          costMinor: sample.costMinor,
          categoryId: sample.categoryId,
          unitId: unit.id,
          trackInventory: sample.trackInventory,
          status: "active",
        },
      });
    }
    const imgs = mediaUrl(tenant.id, product.id, sample.imageSlug);
    product = await prisma.product.update({
      where: { id: product.id },
      data: {
        barcode: sample.barcode,
        featured: sample.featured,
        imageUrl: imgs.imageUrl,
        thumbnailUrl: imgs.thumbnailUrl,
        trackInventory: sample.trackInventory,
        priceMinor: sample.priceMinor,
      },
    });

    if (sample.trackInventory) {
      await prisma.stockBalance.upsert({
        where: {
          tenantId_warehouseId_productId: {
            tenantId: tenant.id,
            warehouseId: warehouse.id,
            productId: product.id,
          },
        },
        create: {
          tenantId: tenant.id,
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 80,
        },
        update: { quantity: 80 },
      });
    }
  }

  // Floor plan: 8 tables
  const tableCodes = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
  for (const [i, code] of tableCodes.entries()) {
    await prisma.diningTable.upsert({
      where: {
        tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code },
      },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        code,
        label: `Table ${code.slice(1)}`,
        seats: code === "T7" || code === "T8" ? 6 : 4,
        sortOrder: i,
        status: "free",
      },
      update: { label: `Table ${code.slice(1)}`, seats: code === "T7" || code === "T8" ? 6 : 4 },
    });
  }

  // Also backfill demo tenant images if products exist
  const demo = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (demo) {
    const demoMap: Record<string, string> = {
      "SUGAR-1KG": "sugar",
      "RICE-2KG": "rice",
      "COOKING-OIL-1L": "oil",
      "SOAP-BAR": "soap",
      "MAIZE-FLOUR-2KG": "flour",
    };
    for (const [sku, slug] of Object.entries(demoMap)) {
      const p = await prisma.product.findFirst({ where: { tenantId: demo.id, sku } });
      if (!p) continue;
      const imgs = mediaUrl(demo.id, p.id, slug);
      if (imgs.imageUrl) {
        await prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: imgs.imageUrl, thumbnailUrl: imgs.thumbnailUrl },
        });
      }
    }
  }

  console.log("Honeywell seed complete.");
  console.log({
    tenant: "honeywell",
    email: "owner@honeywell.demo",
    password: "Honeywell123!",
    branch: branch.code,
    products: products.length,
    tables: tableCodes.length,
    note: "POS login: tenant=honeywell — retail + restaurant floor",
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
