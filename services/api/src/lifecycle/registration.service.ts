import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { defaultModulesForTypes, type BusinessType } from "@sokoos/types";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { isReservedSlug } from "../domains/reserved-hosts";
import { ProvisioningService } from "./provisioning.service";
import { EmailService } from "../email/email.service";

export type RegistrationSubmitInput = {
  businessName: string;
  legalName?: string;
  contactName: string;
  email: string;
  phone?: string;
  country?: string;
  industry?: string;
  businessSize?: string;
  requestedModules?: string[];
  preferredSlug: string;
  idempotencyKey?: string;
};

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: ProvisioningService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async submit(input: RegistrationSubmitInput) {
    const preferredSlug = input.preferredSlug.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const businessName = input.businessName.trim();
    const contactName = input.contactName.trim();

    if (!businessName || !contactName || !email || !preferredSlug) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Business name, contact, email, and preferred slug are required",
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({ code: "INVALID_EMAIL", message: "Invalid email" });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(preferredSlug) || isReservedSlug(preferredSlug)) {
      throw new BadRequestException({
        code: "INVALID_OR_RESERVED_SLUG",
        message: "Preferred slug is invalid or reserved",
      });
    }

    const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
    const existingKey = await this.prisma.registrationRequest.findUnique({
      where: { idempotencyKey },
    });
    if (existingKey) {
      return { request: this.publicView(existingKey), reused: true, emailVerifyToken: null as string | null };
    }

    const slugTaken = await this.prisma.tenant.findUnique({ where: { slug: preferredSlug } });
    if (slugTaken) {
      throw new ConflictException({ code: "SLUG_TAKEN", message: "Preferred slug already in use" });
    }
    const pendingSlug = await this.prisma.registrationRequest.findFirst({
      where: {
        preferredSlug,
        status: { in: ["registration_pending", "awaiting_approval", "approved", "info_requested"] },
      },
    });
    if (pendingSlug) {
      throw new ConflictException({
        code: "SLUG_PENDING",
        message: "Preferred slug already has a pending registration",
      });
    }

    const verifyRaw = randomBytes(32).toString("hex");
    const emailVerifyHash = createHash("sha256").update(verifyRaw).digest("hex");

    const request = await this.prisma.registrationRequest.create({
      data: {
        businessName,
        legalName: input.legalName?.trim() || null,
        contactName,
        email,
        phone: input.phone?.trim() || null,
        country: (input.country ?? "KE").slice(0, 8),
        industry: input.industry?.trim() || null,
        businessSize: input.businessSize?.trim() || null,
        requestedModules: input.requestedModules ?? [],
        preferredSlug,
        status: "registration_pending",
        emailVerifyHash,
        idempotencyKey,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        action: "registration.submitted",
        entityType: "registration_request",
        entityId: request.id,
        metadata: { preferredSlug, email },
      },
    });

    const appBase = (
      this.config.get<string>("SOKOOS_PUBLIC_APP_URL") ??
      this.config.get<string>("API_PUBLIC_URL") ??
      "http://localhost:5175"
    ).replace(/\/$/, "");
    const verifyUrl = `${appBase}/register/verify?id=${request.id}&token=${verifyRaw}`;
    const mail = await this.email.enqueue({
      templateKey: "registration.received",
      toEmail: email,
      toName: contactName,
      idempotencyKey: `registration.received:${request.id}`,
      context: {
        businessName,
        contactName,
        preferredSlug,
        verifyUrl,
      },
    });
    await this.email.processOne(mail.id);

    return {
      request: this.publicView(request),
      reused: false,
      // Dev fallback only — production clients use email
      emailVerifyToken: verifyRaw,
    };
  }

  async verifyEmail(requestId: string, rawToken: string) {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException({ code: "NOT_FOUND", message: "Registration not found" });
    if (request.emailVerifiedAt) {
      return this.publicView(request);
    }
    const hash = createHash("sha256").update(rawToken).digest("hex");
    if (!request.emailVerifyHash || request.emailVerifyHash !== hash) {
      throw new BadRequestException({ code: "VERIFY_FAILED", message: "Invalid verification token" });
    }
    const updated = await this.prisma.registrationRequest.update({
      where: { id: requestId },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyHash: null,
        status: "awaiting_approval",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        action: "registration.email_verified",
        entityType: "registration_request",
        entityId: requestId,
        metadata: {},
      },
    });
    return this.publicView(updated);
  }

  async list(status?: string) {
    return this.prisma.registrationRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async get(id: string) {
    const row = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Not found" });
    return row;
  }

  async review(
    id: string,
    action: "approve" | "reject" | "request_info",
    actorUserId: string,
    notes?: string,
  ) {
    const row = await this.get(id);
    if (!["awaiting_approval", "info_requested", "registration_pending"].includes(row.status)) {
      throw new BadRequestException({
        code: "INVALID_STATE",
        message: `Cannot review registration in status ${row.status}`,
      });
    }
    if (action === "approve" && !row.emailVerifiedAt) {
      throw new BadRequestException({
        code: "EMAIL_UNVERIFIED",
        message: "Email must be verified before approval",
      });
    }
    const status =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "info_requested";
    const updated = await this.prisma.registrationRequest.update({
      where: { id },
      data: {
        status,
        reviewNotes: notes ?? row.reviewNotes,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        actorUserId,
        action: `registration.${action}`,
        entityType: "registration_request",
        entityId: id,
        metadata: { notes: notes ?? null },
      },
    });
    return updated;
  }

  /** Approve then provision in one operator action (idempotent via registration id). */
  async approveAndProvision(id: string, actorUserId: string, notes?: string) {
    let row = await this.get(id);
    if (row.status === "provisioned" && row.resultingTenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: row.resultingTenantId } });
      return {
        registration: row,
        provision: {
          tenantId: row.resultingTenantId,
          slug: tenant?.slug ?? row.preferredSlug,
          reused: true,
          activationToken: "",
          domainHostname: `${row.preferredSlug}.${process.env.SOKOOS_BASE_DOMAIN ?? "sokoos.com"}`,
        },
      };
    }
    if (row.status !== "approved") {
      row = await this.review(id, "approve", actorUserId, notes);
    }

    const industry = (row.industry ?? "retail") as BusinessType;
    const types = (["retail", "restaurant", "hotel", "pharmacy", "wholesale", "hardware", "services"].includes(
      industry,
    )
      ? [industry]
      : ["retail"]) as BusinessType[];

    const provision = await this.provisioning.provision({
      idempotencyKey: `registration:${row.id}`,
      businessName: row.businessName,
      legalName: row.legalName ?? undefined,
      slug: row.preferredSlug,
      email: row.email,
      phone: row.phone ?? undefined,
      country: row.country,
      businessTypes: types,
      modulesEnabled: defaultModulesForTypes(types),
      adminName: row.contactName,
      adminEmail: row.email,
      adminPhone: row.phone ?? undefined,
      actorUserId,
      registrationRequestId: row.id,
      initialStatus: "invitation_pending",
    });

    const refreshed = await this.get(id);
    return { registration: refreshed, provision };
  }

  private publicView(row: {
    id: string;
    businessName: string;
    preferredSlug: string;
    status: string;
    email: string;
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      businessName: row.businessName,
      preferredSlug: row.preferredSlug,
      status: row.status,
      email: row.email,
      emailVerified: Boolean(row.emailVerifiedAt),
      createdAt: row.createdAt,
    };
  }
}
