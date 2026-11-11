export type IntegrationProvider = "mpesa" | "etims" | "printer" | "notifications";

export type IntegrationHealth = {
  provider: IntegrationProvider;
  configured: boolean;
  mode: "live" | "sandbox" | "disabled";
  lastSuccessAt: string | null;
  lastError: string | null;
  notes: string;
};

/** Documented external authorization requirements — never fake success without credentials. */
export const INTEGRATION_REQUIREMENTS: Record<IntegrationProvider, string> = {
  mpesa:
    "Requires Safaricom Daraja consumer key/secret + passkey + shortcode. STK callbacks must be verified before marking payment completed.",
  etims:
    "Requires KRA eTIMS OSCU/VSCU credentials. Fiscal invoice numbers are only stored after provider acknowledgement.",
  printer: "Requires registered device printer target (USB/network). Jobs stay queued until the terminal acknowledges print.",
  notifications: "Optional SMTP/SMS provider credentials. Without them, notifications remain in-app only.",
};
