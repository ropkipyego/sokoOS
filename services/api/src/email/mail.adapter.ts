export type SendMailInput = {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};

export type SendMailResult = {
  /** Provider accepted the request — not proof of mailbox delivery */
  accepted: boolean;
  providerMessageId?: string;
  error?: string;
};

export interface MailAdapter {
  readonly name: string;
  send(input: SendMailInput): Promise<SendMailResult>;
}

/** Development adapter: writes to logs/file sink conceptually; never claims delivery. */
export class DevMailAdapter implements MailAdapter {
  readonly name = "dev";

  async send(input: SendMailInput): Promise<SendMailResult> {
    // Intentionally no console of secrets/tokens — subject + recipient only
    // eslint-disable-next-line no-console
    console.info(`[dev-mail] accepted to=${input.to} subject=${input.subject}`);
    return {
      accepted: true,
      providerMessageId: `dev-${Date.now()}`,
    };
  }
}

/**
 * SMTP adapter scaffold — activates only when SMTP_URL is configured.
 * Does not invent delivery; status stays `sent` until a webhook upgrades it.
 */
export class SmtpMailAdapter implements MailAdapter {
  readonly name = "smtp";

  constructor(private readonly smtpUrl: string) {}

  async send(input: SendMailInput): Promise<SendMailResult> {
    // Production should use nodemailer/provider SDK. Without deps, refuse silent success.
    if (!this.smtpUrl) {
      return { accepted: false, error: "SMTP_URL not configured" };
    }
    return {
      accepted: false,
      error:
        "SMTP adapter is configured but nodemailer transport is not installed in this build — use MAIL_PROVIDER=dev or install transport",
    };
  }
}

export function createMailAdapter(env: {
  MAIL_PROVIDER?: string;
  SMTP_URL?: string;
}): MailAdapter {
  const provider = (env.MAIL_PROVIDER ?? "dev").toLowerCase();
  if (provider === "smtp") return new SmtpMailAdapter(env.SMTP_URL ?? "");
  return new DevMailAdapter();
}
