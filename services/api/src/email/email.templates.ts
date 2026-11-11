export type TemplateContext = Record<string, string | number | boolean | null | undefined>;

export type RenderedEmail = {
  subject: string;
  text: string;
  html?: string;
};

const TEMPLATES: Record<string, (ctx: TemplateContext) => RenderedEmail> = {
  "registration.received": (c) => ({
    subject: `We received your SokoOS registration — ${c.businessName}`,
    text: `Hello ${c.contactName},\n\nWe received your registration for ${c.businessName} (slug: ${c.preferredSlug}).\nVerify your email: ${c.verifyUrl}\n\n— SokoOS`,
  }),
  "registration.approved": (c) => ({
    subject: `Registration approved — ${c.businessName}`,
    text: `Hello ${c.contactName},\n\nYour registration for ${c.businessName} was approved. You will receive an administrator invitation next.\n\n— SokoOS`,
  }),
  "registration.rejected": (c) => ({
    subject: `Registration update — ${c.businessName}`,
    text: `Hello ${c.contactName},\n\nWe could not approve ${c.businessName} at this time.\nNotes: ${c.notes ?? "n/a"}\n\n— SokoOS`,
  }),
  "admin.invitation": (c) => ({
    subject: `Activate your SokoOS administrator account — ${c.businessName}`,
    text: `Hello ${c.adminName},\n\nYou are invited to administer ${c.businessName}.\nActivate (one-time, expires): ${c.activateUrl}\nHostname: ${c.hostname}\n\nNever share this link. SokoOS will never email a permanent password.\n\n— SokoOS`,
  }),
  "invitation.reminder": (c) => ({
    subject: `Reminder: activate ${c.businessName}`,
    text: `Hello ${c.adminName},\n\nYour invitation is still pending. Activate: ${c.activateUrl}\nExpires: ${c.expiresAt}\n\n— SokoOS`,
  }),
  "email.verification": (c) => ({
    subject: "Verify your email — SokoOS",
    text: `Verify: ${c.verifyUrl}`,
  }),
  "password.reset": (c) => ({
    subject: "Reset your SokoOS password",
    text: `Hello,\n\nReset link (one-time): ${c.resetUrl}\nIf you did not request this, ignore this email.\n\n— SokoOS`,
  }),
  "business.activation": (c) => ({
    subject: `${c.businessName} is ready on SokoOS`,
    text: `Your business environment is active at ${c.hostname}.`,
  }),
  "subscription.invoice": (c) => ({
    subject: `Invoice ${c.invoiceNumber} — SokoOS`,
    text: `Invoice ${c.invoiceNumber} for ${c.amount} ${c.currency} is ready.`,
  }),
  "payment.confirmation": (c) => ({
    subject: `Payment received — ${c.invoiceNumber}`,
    text: `We recorded payment ${c.paymentRef} for ${c.amount} ${c.currency}.`,
  }),
  "subscription.renewal_reminder": (c) => ({
    subject: `Renewal reminder — ${c.businessName}`,
    text: `Your subscription renews on ${c.renewalDate}.`,
  }),
  "subscription.overdue": (c) => ({
    subject: `Subscription overdue — ${c.businessName}`,
    text: `Payment is overdue. Access may enter grace/read-only soon.`,
  }),
  "account.suspension": (c) => ({
    subject: `Account suspended — ${c.businessName}`,
    text: `Your SokoOS account was suspended. Contact support if this is unexpected.`,
  }),
  "security.notification": (c) => ({
    subject: `Security notice — ${c.event}`,
    text: `${c.detail}`,
  }),
  "platform.announcement": (c) => ({
    subject: String(c.subject ?? "SokoOS announcement"),
    text: String(c.body ?? ""),
  }),
};

export function renderTemplate(key: string, ctx: TemplateContext): RenderedEmail {
  const fn = TEMPLATES[key];
  if (!fn) {
    return {
      subject: `SokoOS: ${key}`,
      text: JSON.stringify(ctx),
    };
  }
  return fn(ctx);
}

export const EMAIL_TEMPLATE_KEYS = Object.keys(TEMPLATES);
