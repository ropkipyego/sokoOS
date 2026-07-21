import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService } from "../roles/roles.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
  ) {}

  async list(tenantId: string, opts: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const cursor = decodeCursor<{ id: string }>(opts.cursor);

    const rows = await this.prisma.user.findMany({
      where: {
        tenantId,
        ...(cursor ? { id: { gt: cursor.id } } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: { role: true, branch: true },
        },
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

  async get(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        userRoles: { include: { role: true, branch: true } },
      },
    });
    if (!user) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "User not found" });
    }
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async create(
    tenantId: string,
    input: {
      email: string;
      name: string;
      password: string;
      phone?: string;
      roleId?: string;
      branchId?: string;
    },
  ) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
    });
    if (existing) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Email already in use",
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        name: input.name,
        phone: input.phone,
        passwordHash,
      },
    });

    if (input.roleId) {
      await this.assignRole(tenantId, user.id, {
        roleId: input.roleId,
        branchId: input.branchId,
      });
    }

    return this.get(tenantId, user.id);
  }

  async update(
    tenantId: string,
    id: string,
    input: { name?: string; phone?: string; status?: string },
  ) {
    await this.get(tenantId, id);
    await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone,
        status: input.status,
      },
    });
    return this.get(tenantId, id);
  }

  async assignRole(
    tenantId: string,
    userId: string,
    input: { roleId: string; branchId?: string },
  ) {
    await this.get(tenantId, userId);
    const role = await this.prisma.role.findFirst({
      where: {
        id: input.roleId,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });
    if (!role) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Role not found" });
    }

    const ur = await this.prisma.userRole.create({
      data: {
        tenantId,
        userId,
        roleId: input.roleId,
        branchId: input.branchId ?? null,
      },
    });
    await this.roles.bumpAuthzVersion(tenantId);
    return ur;
  }

  async removeRole(tenantId: string, userId: string, userRoleId: string) {
    await this.get(tenantId, userId);
    await this.prisma.userRole.deleteMany({
      where: { id: userRoleId, userId, tenantId },
    });
    await this.roles.bumpAuthzVersion(tenantId);
    return { ok: true };
  }
}
