/**
 * Demo seed: tenant "demo", branch Main, owner demo@sokoos.local / Demo123!,
 * permissions, cashier role, sample products, default warehouse.
 *
 * Usage: pnpm --filter @sokoos/api seed
 */
import "reflect-metadata";
import * as bcrypt from "bcryptjs";
import { createPrismaClient } from "@sokoos/database";
import { CORE_PERMISSION_KEYS } from "@sokoos/types";
import { SystemRole } from "@sokoos/shared";
import { ROLE_PERMISSION_TEMPLATES } from "../roles/roles.service";

const prisma = createPrismaClient(process.env.DATABASE_URL);

async function upsertPermission(key: string) {
  return prisma.permission.upsert({
    where: { key },
    create: {
      key,
      description: key,
      category: key.split(".")[0] ?? "core",
    },
    update: {},
  });
}

async function ensureRoleWithPermissions(
  tenantId: string | null,
  key: string,
  name: string,
  permissionKeys: readonly string[],
  isSystem = true,
) {
  let role = await prisma.role.findFirst({
    where: { tenantId, key },
  });
  if (!role) {
    role = await prisma.role.create({
      data: { tenantId, key, name, isSystem },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: [...permissionKeys] } },
  });

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: perm.id,
        },
      },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
  }

  return role;
}

async function main() {
  console.log("Seeding SokoOS demo data…");

  for (const key of CORE_PERMISSION_KEYS) {
    await upsertPermission(key);
  }
  console.log(`Permissions: ${CORE_PERMISSION_KEYS.length}`);

  // Platform owner template (tenantId null)
  await ensureRoleWithPermissions(
    null,
    SystemRole.PlatformOwner,
    "Platform Owner",
    CORE_PERMISSION_KEYS.filter((k) => k.startsWith("platform.")),
  );

  let tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Demo Shop",
        slug: "demo",
        currency: "KES",
        timezone: "Africa/Nairobi",
        locale: "en-KE",
        status: "active",
        settings: { negativeStockPolicy: "block" },
      },
    });
    console.log("Created tenant demo");
  } else {
    console.log("Tenant demo already exists");
  }

  await prisma.authzVersion.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, version: 1 },
    update: {},
  });

  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, code: "MAIN" },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: "Main",
        code: "MAIN",
        status: "active",
      },
    });
    console.log("Created branch Main");
  }

  const ownerPerms =
    ROLE_PERMISSION_TEMPLATES[SystemRole.BusinessOwner] ??
    CORE_PERMISSION_KEYS.filter((k) => !k.startsWith("platform."));
  const ownerRole = await ensureRoleWithPermissions(
    tenant.id,
    SystemRole.BusinessOwner,
    "Business Owner",
    ownerPerms,
  );

  const cashierPerms =
    ROLE_PERMISSION_TEMPLATES[SystemRole.Cashier] ??
    ([
      "products.read",
      "categories.read",
      "inventory.read",
      "sales.create",
      "sales.read",
      "returns.create",
      "returns.read",
      "notifications.read",
    ] as const);
  const cashierRole = await ensureRoleWithPermissions(
    tenant.id,
    SystemRole.Cashier,
    "Cashier",
    cashierPerms,
  );

  // Extra templates
  for (const [key, perms] of Object.entries(ROLE_PERMISSION_TEMPLATES)) {
    if (key === SystemRole.BusinessOwner || key === SystemRole.Cashier) continue;
    await ensureRoleWithPermissions(
      tenant.id,
      key,
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      perms,
    );
  }

  const passwordHash = await bcrypt.hash("Demo123!", 12);
  let user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "demo@sokoos.local" },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "demo@sokoos.local",
        name: "Demo Owner",
        passwordHash,
        status: "active",
      },
    });
    console.log("Created user demo@sokoos.local");
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    console.log("Updated demo user password");
  }

  const existingOwnerBinding = await prisma.userRole.findFirst({
    where: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: ownerRole.id,
      branchId: null,
    },
  });
  if (!existingOwnerBinding) {
    await prisma.userRole.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRole.id,
        branchId: null,
      },
    });
  }

  // Also bind cashier for POS testing convenience
  const existingCashierBinding = await prisma.userRole.findFirst({
    where: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: cashierRole.id,
      branchId: branch.id,
    },
  });
  if (!existingCashierBinding) {
    await prisma.userRole.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: cashierRole.id,
        branchId: branch.id,
      },
    });
  }

  let warehouse = await prisma.warehouse.findFirst({
    where: { tenantId: tenant.id, branchId: branch.id, isDefault: true },
  });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: "Main Store",
        isDefault: true,
        status: "active",
      },
    });
    console.log("Created default warehouse");
  }

  let unit = await prisma.unit.findFirst({
    where: { tenantId: tenant.id, abbreviation: "pcs" },
  });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        tenantId: tenant.id,
        name: "Piece",
        abbreviation: "pcs",
      },
    });
  }

  let category = await prisma.category.findFirst({
    where: { tenantId: tenant.id, name: "General" },
  });
  if (!category) {
    category = await prisma.category.create({
      data: { tenantId: tenant.id, name: "General", sortOrder: 0 },
    });
  }

  const samples = [
    { sku: "SUGAR-1KG", name: "Sugar 1kg", priceMinor: 25000, costMinor: 18000 },
    { sku: "RICE-2KG", name: "Rice 2kg", priceMinor: 35000, costMinor: 28000 },
    { sku: "COOKING-OIL-1L", name: "Cooking Oil 1L", priceMinor: 42000, costMinor: 35000 },
    { sku: "SOAP-BAR", name: "Bar Soap", priceMinor: 8000, costMinor: 5000 },
    { sku: "MAIZE-FLOUR-2KG", name: "Maize Flour 2kg", priceMinor: 22000, costMinor: 16000 },
  ];

  for (const sample of samples) {
    let product = await prisma.product.findFirst({
      where: { tenantId: tenant.id, sku: sample.sku },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          sku: sample.sku,
          name: sample.name,
          priceMinor: sample.priceMinor,
          costMinor: sample.costMinor,
          categoryId: category.id,
          unitId: unit.id,
          trackInventory: true,
          status: "active",
        },
      });
    }

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
        quantity: 100,
      },
      update: {},
    });
  }

  console.log("Seed complete.");
  console.log({
    tenant: tenant.slug,
    branch: branch.code,
    email: "demo@sokoos.local",
    password: "Demo123!",
    warehouse: warehouse.name,
    products: samples.length,
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
