import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "./email.service";

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private publicBase(): string {
    return (
      this.config.get<string>("SOKOOS_PUBLIC_APP_URL") ??
      this.config.get<string>("API_PUBLIC_URL") ??
      "http://localhost:5175"
    ).replace(/\/$/, "");
  }

  async acceptInvitation(rawToken: string, password: string, name?: string) {
    if (!password || password.length < 10) {
      throw new BadRequestException({
        code: "WEAK_PASSWORD",
        message: "Password must be at least 10 characters",
      });
    }
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const invite = await this.prisma.tenantInvitation.findFirst({
      where: { tokenHash, status: "pending" },
      include: { tenant: true },
    });
    if (!invite) {
      const tenants = await this.prisma.tenant.findMany({
        where: { status: { in: ["invitation_pending", "active"] } },
        take: 100,
      });
      for (const t of tenants) {
        const settings = t.settings as Record<string, unknown>;
        if (settings.inviteActivationHash === tokenHash) {
          return this.activateLegacy(t.id, tokenHash, password, name);
        }
      }
      throw new BadRequestException({
        code: "INVALID_INVITE",
        message: "Invitation is invalid, revoked, or expired",
      });
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.tenantInvitation.update({
        where: { id: invite.id },
        data: { status: "expired" },
      });
      throw new BadRequestException({
        code: "INVITE_EXPIRED",
        message: "Invitation has expired",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.findFirst({
      where: { tenantId: invite.tenantId, email: invite.email },
    });
    if (!user) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "Invited user missing" });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: "active",
          name: name?.trim() || user.name,
        },
      });
      await tx.tenantInvitation.update({
        where: { id: invite.id },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
          resultingUserId: user.id,
        },
      });
      if (invite.tenant.status === "invitation_pending") {
        await tx.tenant.update({
          where: { id: invite.tenantId },
          data: { status: "active" },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: invite.tenantId,
          actorUserId: user.id,
          action: "invitation.accepted",
          entityType: "tenant_invitation",
          entityId: invite.id,
          metadata: {},
        },
      });
    });

    return {
      tenantId: invite.tenantId,
      tenantSlug: invite.tenant.slug,
      userId: user.id,
      email: user.email,
    };
  }

  private async activateLegacy(
    tenantId: string,
    tokenHash: string,
    password: string,
    name?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "TENANT_NOT_FOUND", message: "Not found" });
    const settings = tenant.settings as Record<string, unknown>;
    if (settings.inviteActivationHash !== tokenHash) {
      throw new BadRequestException({ code: "INVALID_INVITE", message: "Invalid token" });
    }
    const user = await this.prisma.user.findFirst({
      where: { tenantId, status: "invited" },
      orderBy: { createdAt: "asc" },
    });
    if (!user) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "No invited user" });
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, status: "active", name: name?.trim() || user.name },
      });
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: "active",
          settings: {
            ...settings,
            inviteActivationHash: null,
            activatedAt: new Date().toISOString(),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: user.id,
          action: "invitation.accepted_legacy",
          entityType: "tenant",
          entityId: tenantId,
          metadata: {},
        },
      });
    });
    return { tenantId, tenantSlug: tenant.slug, userId: user.id, email: user.email };
  }

  async resend(invitationId: string, actorUserId: string) {
    const invite = await this.prisma.tenantInvitation.findUnique({
      where: { id: invitationId },
      include: { tenant: true },
    });
    if (!invite || invite.status === "accepted" || invite.status === "revoked") {
      throw new BadRequestException({ code: "CANNOT_RESEND", message: "Cannot resend this invitation" });
    }
    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.tenantInvitation.update({
      where: { id: invitationId },
      data: { tokenHash, expiresAt, status: "pending" },
    });
    const domain = await this.prisma.tenantDomain.findFirst({
      where: { tenantId: invite.tenantId, isPrimary: true },
    });
    const activateUrl = `${this.publicBase()}/activate?token=${raw}`;
    const msg = await this.email.enqueue({
      templateKey: "admin.invitation",
      toEmail: invite.email,
      toName: invite.name ?? undefined,
      tenantId: invite.tenantId,
      idempotencyKey: `invite-resend:${invitationId}:${expiresAt.toISOString()}`,
      context: {
        adminName: invite.name ?? invite.email,
        businessName: invite.tenant.name,
        activateUrl,
        hostname: domain?.hostname ?? `${invite.tenant.slug}.sokoos.com`,
      },
    });
    await this.email.processOne(msg.id);
    await this.prisma.auditLog.create({
      data: {
        tenantId: invite.tenantId,
        actorUserId,
        action: "invitation.resent",
        entityType: "tenant_invitation",
        entityId: invitationId,
        metadata: {},
      },
    });
    return { invitationId, activationToken: raw, activateUrl };
  }

  async revoke(invitationId: string, actorUserId: string) {
    const invite = await this.prisma.tenantInvitation.findUnique({ where: { id: invitationId } });
    if (!invite) throw new NotFoundException({ code: "NOT_FOUND", message: "Not found" });
    const updated = await this.prisma.tenantInvitation.update({
      where: { id: invitationId },
      data: { status: "revoked", revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: invite.tenantId,
        actorUserId,
        action: "invitation.revoked",
        entityType: "tenant_invitation",
        entityId: invitationId,
        metadata: {},
      },
    });
    return updated;
  }

  async requestPasswordReset(email: string, tenantSlug?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {}),
      },
    });
    if (!user) return { queued: true };

    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const resetUrl = `${this.publicBase()}/reset-password?token=${raw}`;
    const msg = await this.email.enqueue({
      templateKey: "password.reset",
      toEmail: user.email,
      toName: user.name,
      tenantId: user.tenantId ?? undefined,
      idempotencyKey: `pwd-reset:${user.id}:${Math.floor(Date.now() / 60_000)}`,
      context: { resetUrl },
    });
    await this.email.processOne(msg.id);
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "auth.password_reset_requested",
        entityType: "user",
        entityId: user.id,
        metadata: {},
      },
    });
    return { queued: true };
  }

  async completePasswordReset(rawToken: string, password: string) {
    if (!password || password.length < 10) {
      throw new BadRequestException({
        code: "WEAK_PASSWORD",
        message: "Password must be at least 10 characters",
      });
    }
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!row || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: "INVALID_RESET",
        message: "Reset token is invalid or expired",
      });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash, status: "active" },
      });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          tenantId: null,
          actorUserId: row.userId,
          action: "auth.password_reset_completed",
          entityType: "user",
          entityId: row.userId,
          metadata: {},
        },
      });
    });
    return { ok: true };
  }
}
