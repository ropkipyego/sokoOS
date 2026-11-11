import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, branchId?: string) {
    return this.prisma.department.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        _count: { select: { members: true, devices: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        devices: { include: { device: { select: { id: true, name: true, status: true } } } },
        branch: true,
      },
    });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Department not found" });
    return row;
  }

  async create(
    tenantId: string,
    input: {
      code: string;
      name: string;
      description?: string;
      type?: string;
      branchId?: string;
      sortOrder?: number;
      settings?: object;
    },
    userId: string,
  ) {
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: input.branchId, tenantId },
      });
      if (!branch) throw new NotFoundException({ code: "NOT_FOUND", message: "Branch not found" });
    }
    try {
      return await this.prisma.department.create({
        data: {
          tenantId,
          branchId: input.branchId ?? null,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          description: input.description,
          type: input.type ?? "retail",
          sortOrder: input.sortOrder ?? 0,
          settings: input.settings ?? {},
          createdBy: userId,
        },
      });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
        throw new ConflictException({ code: "CONFLICT", message: "Department code already exists" });
      }
      throw err;
    }
  }

  async update(
    tenantId: string,
    id: string,
    input: {
      name?: string;
      description?: string;
      type?: string;
      branchId?: string | null;
      status?: string;
      sortOrder?: number;
      settings?: object;
    },
    userId: string,
  ) {
    await this.get(tenantId, id);
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId } });
    const mergedSettings =
      input.settings && existing?.settings && typeof existing.settings === "object"
        ? { ...(existing.settings as object), ...input.settings }
        : input.settings;
    return this.prisma.department.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        type: input.type,
        branchId: input.branchId === undefined ? undefined : input.branchId,
        status: input.status,
        sortOrder: input.sortOrder,
        settings: mergedSettings,
        updatedBy: userId,
      },
    });
  }

  async addMember(tenantId: string, departmentId: string, userId: string) {
    await this.get(tenantId, departmentId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException({ code: "NOT_FOUND", message: "User not found" });
    return this.prisma.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      create: { tenantId, departmentId, userId },
      update: {},
    });
  }

  async removeMember(tenantId: string, departmentId: string, userId: string) {
    await this.get(tenantId, departmentId);
    await this.prisma.departmentMember.deleteMany({ where: { tenantId, departmentId, userId } });
    return { ok: true };
  }

  async assignDevice(tenantId: string, departmentId: string, deviceId: string) {
    await this.get(tenantId, departmentId);
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, tenantId } });
    if (!device) throw new NotFoundException({ code: "NOT_FOUND", message: "Device not found" });
    return this.prisma.departmentDevice.upsert({
      where: { departmentId_deviceId: { departmentId, deviceId } },
      create: { tenantId, departmentId, deviceId },
      update: {},
    });
  }

  async unassignDevice(tenantId: string, departmentId: string, deviceId: string) {
    await this.get(tenantId, departmentId);
    await this.prisma.departmentDevice.deleteMany({ where: { tenantId, departmentId, deviceId } });
    return { ok: true };
  }

  listProducts(tenantId: string, departmentId: string) {
    return this.prisma.departmentProduct.findMany({
      where: { tenantId, departmentId },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            priceMinor: true,
            itemType: true,
            trackInventory: true,
            imageUrl: true,
            thumbnailUrl: true,
            status: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async offerProduct(
    tenantId: string,
    departmentId: string,
    input: { productId: string; priceMinor?: number | null; available?: boolean; sortOrder?: number },
  ) {
    await this.get(tenantId, departmentId);
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId },
    });
    if (!product) throw new NotFoundException({ code: "NOT_FOUND", message: "Product not found" });
    return this.prisma.departmentProduct.upsert({
      where: { departmentId_productId: { departmentId, productId: input.productId } },
      create: {
        tenantId,
        departmentId,
        productId: input.productId,
        priceMinor: input.priceMinor ?? null,
        available: input.available ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      update: {
        priceMinor: input.priceMinor === undefined ? undefined : input.priceMinor,
        available: input.available,
        sortOrder: input.sortOrder,
      },
      include: { product: true },
    });
  }

  async removeProduct(tenantId: string, departmentId: string, productId: string) {
    await this.get(tenantId, departmentId);
    await this.prisma.departmentProduct.deleteMany({ where: { tenantId, departmentId, productId } });
    return { ok: true };
  }
}
