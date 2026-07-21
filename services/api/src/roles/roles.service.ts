import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { CORE_PERMISSION_KEYS } from "@sokoos/types";
import { SystemRole } from "@sokoos/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Default permission sets for platform role templates. */
export const ROLE_PERMISSION_TEMPLATES: Record<string, readonly string[]> = {
  [SystemRole.BusinessOwner]: CORE_PERMISSION_KEYS.filter(
    (k) => !k.startsWith("platform."),
  ),
  [SystemRole.BranchManager]: [
    "branches.read",
    "devices.read",
    "devices.write",
    "users.read",
    "roles.read",
    "products.read",
    "products.write",
    "categories.read",
    "categories.write",
    "inventory.read",
    "inventory.adjust",
    "inventory.transfer",
    "sales.create",
    "sales.read",
    "sales.void",
    "sales.discount",
    "returns.create",
    "returns.read",
    "purchases.read",
    "purchases.write",
    "purchases.receive",
    "suppliers.read",
    "suppliers.write",
    "expenses.read",
    "expenses.write",
    "reports.read",
    "audit.read",
    "notifications.read",
    "tenant.settings.read",
  ],
  [SystemRole.Cashier]: [
    "products.read",
    "categories.read",
    "inventory.read",
    "sales.create",
    "sales.read",
    "returns.create",
    "returns.read",
    "notifications.read",
  ],
  [SystemRole.InventoryOfficer]: [
    "products.read",
    "products.write",
    "categories.read",
    "inventory.read",
    "inventory.adjust",
    "inventory.transfer",
    "purchases.read",
    "purchases.receive",
    "suppliers.read",
    "reports.read",
    "notifications.read",
  ],
  [SystemRole.Auditor]: [
    "products.read",
    "categories.read",
    "inventory.read",
    "sales.read",
    "returns.read",
    "purchases.read",
    "expenses.read",
    "reports.read",
    "audit.read",
    "notifications.read",
  ],
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissionKeys(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    const keys = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        keys.add(rp.permission.key);
      }
    }
    return [...keys].sort();
  }

  async getAuthzVersion(tenantId: string): Promise<number> {
    const row = await this.prisma.authzVersion.findUnique({
      where: { tenantId },
    });
    return row?.version ?? 1;
  }

  async bumpAuthzVersion(tenantId: string): Promise<number> {
    const row = await this.prisma.authzVersion.upsert({
      where: { tenantId },
      create: { tenantId, version: 1 },
      update: { version: { increment: 1 } },
    });
    return row.version;
  }

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null, isSystem: true }],
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  async getRole(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    if (!role) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Role not found" });
    }
    return role;
  }

  async createRole(
    tenantId: string,
    input: { key: string; name: string; permissionKeys?: string[] },
  ) {
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, key: input.key },
    });
    if (existing) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Role key already exists",
      });
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        key: input.key,
        name: input.name,
        isSystem: false,
      },
    });

    if (input.permissionKeys?.length) {
      await this.setRolePermissions(tenantId, role.id, input.permissionKeys);
    }

    await this.bumpAuthzVersion(tenantId);
    return this.getRole(tenantId, role.id);
  }

  async setRolePermissions(
    tenantId: string,
    roleId: string,
    permissionKeys: string[],
  ) {
    const role = await this.getRole(tenantId, roleId);
    if (role.isSystem && role.tenantId === null) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Cannot modify platform system role permissions",
      });
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }
    });

    await this.bumpAuthzVersion(tenantId);
    return this.getRole(tenantId, roleId);
  }

  /** Ensure CORE_PERMISSION_KEYS exist in DB. */
  async ensurePermissionsSeeded(): Promise<void> {
    for (const key of CORE_PERMISSION_KEYS) {
      await this.prisma.permission.upsert({
        where: { key },
        create: {
          key,
          description: key,
          category: key.split(".")[0] ?? "core",
        },
        update: {},
      });
    }
  }
}
