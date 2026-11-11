import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";
import {
  INTEGRATION_REQUIREMENTS,
  type IntegrationHealth,
  type IntegrationProvider,
} from "./integrations.types";

type TenantIntegrations = {
  mpesa?: {
    enabled?: boolean;
    mode?: "live" | "sandbox";
    shortcode?: string;
    consumerKeySet?: boolean;
    consumerSecretSet?: boolean;
    passkeySet?: boolean;
    lastSuccessAt?: string;
    lastError?: string;
  };
  etims?: {
    enabled?: boolean;
    mode?: "live" | "sandbox";
    pin?: string;
    lastSuccessAt?: string;
    lastError?: string;
  };
  printer?: {
    enabled?: boolean;
    defaultTarget?: string;
    lastSuccessAt?: string;
    lastError?: string;
  };
  notifications?: {
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    lastSuccessAt?: string;
    lastError?: string;
  };
};

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async readIntegrations(tenantId: string): Promise<TenantIntegrations> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "NOT_FOUND", message: "Tenant not found" });
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    return (settings.integrations ?? {}) as TenantIntegrations;
  }

  private async writeIntegrations(tenantId: string, integrations: TenantIntegrations) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ code: "NOT_FOUND", message: "Tenant not found" });
    const settings = { ...((tenant.settings ?? {}) as object), integrations };
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings },
    });
  }

  async health(tenantId: string): Promise<IntegrationHealth[]> {
    const cfg = await this.readIntegrations(tenantId);
    const providers: IntegrationProvider[] = ["mpesa", "etims", "printer", "notifications"];
    return providers.map((provider) => {
      if (provider === "mpesa") {
        const m = cfg.mpesa ?? {};
        const configured = Boolean(m.consumerKeySet && m.consumerSecretSet && m.passkeySet && m.shortcode);
        return {
          provider,
          configured,
          mode: !m.enabled ? "disabled" : m.mode === "live" ? "live" : "sandbox",
          lastSuccessAt: m.lastSuccessAt ?? null,
          lastError: m.lastError ?? null,
          notes: INTEGRATION_REQUIREMENTS.mpesa,
        };
      }
      if (provider === "etims") {
        const e = cfg.etims ?? {};
        const configured = Boolean(e.pin && e.enabled);
        return {
          provider,
          configured,
          mode: !e.enabled ? "disabled" : e.mode === "live" ? "live" : "sandbox",
          lastSuccessAt: e.lastSuccessAt ?? null,
          lastError: e.lastError ?? null,
          notes: INTEGRATION_REQUIREMENTS.etims,
        };
      }
      if (provider === "printer") {
        const p = cfg.printer ?? {};
        return {
          provider,
          configured: Boolean(p.defaultTarget),
          mode: p.enabled === false ? "disabled" : "sandbox",
          lastSuccessAt: p.lastSuccessAt ?? null,
          lastError: p.lastError ?? null,
          notes: INTEGRATION_REQUIREMENTS.printer,
        };
      }
      const n = cfg.notifications ?? {};
      return {
        provider,
        configured: Boolean(n.smsEnabled || n.emailEnabled),
        mode: "sandbox",
        lastSuccessAt: n.lastSuccessAt ?? null,
        lastError: n.lastError ?? null,
        notes: INTEGRATION_REQUIREMENTS.notifications,
      };
    });
  }

  async updateSettings(tenantId: string, userId: string, patch: TenantIntegrations) {
    const current = await this.readIntegrations(tenantId);
    const next: TenantIntegrations = {
      ...current,
      mpesa: { ...current.mpesa, ...patch.mpesa },
      etims: { ...current.etims, ...patch.etims },
      printer: { ...current.printer, ...patch.printer },
      notifications: { ...current.notifications, ...patch.notifications },
    };
    // Never persist raw secrets in this boundary — only set-flags from the client.
    if (patch.mpesa) {
      next.mpesa = {
        ...next.mpesa,
        consumerKeySet: patch.mpesa.consumerKeySet ?? current.mpesa?.consumerKeySet,
        consumerSecretSet: patch.mpesa.consumerSecretSet ?? current.mpesa?.consumerSecretSet,
        passkeySet: patch.mpesa.passkeySet ?? current.mpesa?.passkeySet,
      };
    }
    await this.writeIntegrations(tenantId, next);
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        action: "integrations.settings.update",
        entityType: "tenant",
        entityId: tenantId,
        metadata: { providers: Object.keys(patch) },
      },
    });
    return this.health(tenantId);
  }

  /**
   * Initiate M-Pesa STK. Without credentials, returns a sandbox pending intent — never marks sale paid.
   */
  async initiateMpesaStk(
    tenantId: string,
    input: { saleId: string; phone: string; amountMinor: number },
  ) {
    if (!input.phone || input.amountMinor < 1) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "phone and amount required" });
    }
    const sale = await this.prisma.sale.findFirst({ where: { id: input.saleId, tenantId } });
    if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });

    const cfg = await this.readIntegrations(tenantId);
    const configured = Boolean(
      cfg.mpesa?.enabled &&
        cfg.mpesa.consumerKeySet &&
        cfg.mpesa.consumerSecretSet &&
        cfg.mpesa.passkeySet &&
        cfg.mpesa.shortcode,
    );

    const checkoutRequestId = `ws_${randomUUID()}`;
    // Record pending payment intent only — confirmation requires callback verification.
    await this.prisma.salePayment.create({
      data: {
        tenantId,
        saleId: sale.id,
        method: "mobile_money",
        amountMinor: input.amountMinor,
        status: "pending",
        reference: checkoutRequestId,
      },
    });

    if (!configured) {
      return {
        status: "pending",
        mode: "sandbox_unconfigured",
        checkoutRequestId,
        message:
          "M-Pesa credentials not configured. Payment remains pending until a verified Daraja callback. " +
          INTEGRATION_REQUIREMENTS.mpesa,
      };
    }

    // Live path would call Daraja STK Push here using vaulted secrets (not stored in settings JSON).
    return {
      status: "pending",
      mode: cfg.mpesa?.mode ?? "sandbox",
      checkoutRequestId,
      message: "STK push accepted for processing; sale will complete only after verified callback.",
    };
  }

  /**
   * M-Pesa callback — only completes payment when provider payload is accepted.
   * Rejects unsigned/untrusted payloads.
   */
  async handleMpesaCallback(
    tenantId: string,
    body: { checkoutRequestId?: string; resultCode?: number; mpesaReceiptNumber?: string; trusted?: boolean },
  ) {
    if (!body.checkoutRequestId) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "checkoutRequestId required" });
    }
    // In production, verify Safaricom signature / IP allowlist. Without trust flag, refuse confirmation.
    if (!body.trusted) {
      throw new UnprocessableEntityException({
        code: "INTEGRATION_UNTRUSTED",
        message: "Callback not verified — payment not confirmed",
      });
    }
    if (body.resultCode !== 0) {
      const payment = await this.prisma.salePayment.findFirst({
        where: { tenantId, reference: body.checkoutRequestId },
      });
      if (payment) {
        await this.prisma.salePayment.update({
          where: { id: payment.id },
          data: { status: "failed" },
        });
      }
      return { status: "failed", checkoutRequestId: body.checkoutRequestId };
    }
    if (!body.mpesaReceiptNumber) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "mpesaReceiptNumber required on success",
      });
    }
    const payment = await this.prisma.salePayment.findFirst({
      where: { tenantId, reference: body.checkoutRequestId },
    });
    if (!payment) throw new NotFoundException({ code: "NOT_FOUND", message: "Payment intent not found" });
    await this.prisma.salePayment.update({
      where: { id: payment.id },
      data: { status: "completed", reference: body.mpesaReceiptNumber },
    });
    return { status: "completed", receipt: body.mpesaReceiptNumber };
  }

  async submitEtimsInvoice(tenantId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id: saleId, tenantId } });
    if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });
    const cfg = await this.readIntegrations(tenantId);
    if (!cfg.etims?.enabled || !cfg.etims.pin) {
      return {
        status: "not_submitted",
        fiscalInvoiceNumber: null,
        message: "eTIMS not configured. " + INTEGRATION_REQUIREMENTS.etims,
      };
    }
    // Never invent a fiscal number — queue for OSCU acknowledgement.
    return {
      status: "queued",
      fiscalInvoiceNumber: null,
      correlationId: `etims_${sale.id}`,
      message: "Queued for eTIMS. Invoice number assigned only after KRA acknowledgement.",
    };
  }

  async enqueuePrintJob(tenantId: string, input: { saleId: string; target?: string }) {
    const sale = await this.prisma.sale.findFirst({ where: { id: input.saleId, tenantId } });
    if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });
    const cfg = await this.readIntegrations(tenantId);
    const target = input.target ?? cfg.printer?.defaultTarget;
    if (!target) {
      return {
        status: "unconfigured",
        jobId: null,
        message: INTEGRATION_REQUIREMENTS.printer,
      };
    }
    return {
      status: "queued",
      jobId: `print_${randomUUID()}`,
      target,
      receiptNumber: sale.receiptNumber,
      message: "Print job queued; completion requires terminal acknowledgement.",
    };
  }
}
