import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService } from "../roles/roles.service";
import { isTenantAssignableRole } from "../roles/role-scope";
import { EmailService } from "../email/email.service";
import { decodeCursor, encodeCursor, paginateMeta } from "../common/pagination";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
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

  /**
   * Secure employee invitation — never emails a permanent password.
   * Returns raw token once for operator fallback when mail is in dev mode.
   */
  async invite(
    tenantId: string,
    actorUserId: string,
    input: {
      email: string;
      name: string;
      phone?: string;
      roleId?: string;
      branchId?: string;
    },
  ) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email || !name) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Name and email are required",
      });
    }
    const existing = await this.prisma.user.findFirst({ where: { tenantId, email } });
    if (existing) {
      throw new ConflictException({ code: "CONFLICT", message: "Email already in use" });
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "NOT_FOUND", message: "Tenant not found" });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId,
          email,
          name,
          phone: input.phone,
          passwordHash,
          status: "invited",
        },
      });
      await tx.tenantInvitation.create({
        data: {
          tenantId,
          email,
          name,
          roleKey: "employee",
          status: "pending",
          tokenHash,
          expiresAt,
          invitedByUserId: actorUserId,
          resultingUserId: created.id,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "tenant.user.invite",
          entityType: "user",
          entityId: created.id,
          metadata: { email },
        },
      });
      return created;
    });

    if (input.roleId) {
      await this.assignRole(tenantId, user.id, {
        roleId: input.roleId,
        branchId: input.branchId,
      });
    }

    const domain = await this.prisma.tenantDomain.findFirst({
      where: { tenantId, isPrimary: true, status: { not: "removed" } },
    });
    const appBase = (
      this.config.get<string>("SOKOOS_PUBLIC_APP_URL") ??
      this.config.get<string>("API_PUBLIC_URL") ??
      "http://localhost:5175"
    ).replace(/\/$/, "");
    const activateUrl = `${appBase}/activate?token=${rawToken}`;
    const mail = await this.email.enqueue({
      templateKey: "employee.invitation",
      toEmail: email,
      toName: name,
      tenantId,
      idempotencyKey: `tenant.invite:${user.id}`,
      context: {
        adminName: name,
        businessName: tenant.name,
        activateUrl,
        hostname: domain?.hostname ?? `${tenant.slug}.sokoos.com`,
      },
    });
    await this.email.processOne(mail.id);

    return {
      user: await this.get(tenantId, user.id),
      activationToken: rawToken,
      activateUrl,
      expiresAt,
    };
  }

  async assignRole(
    tenantId: string,
    userId: string,
    input: { roleId: string; branchId?: string },
  ) {
    await this.get(tenantId, userId);
    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId },
    });
    if (!isTenantAssignableRole(role, tenantId)) {
      if (!role || role.tenantId !== tenantId) {
        throw new NotFoundException({ code: "NOT_FOUND", message: "Role not found" });
      }
      throw new ForbiddenException({
        code: "PLATFORM_ROLE_FORBIDDEN",
        message: "Platform roles cannot be assigned to tenant users",
      });
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
