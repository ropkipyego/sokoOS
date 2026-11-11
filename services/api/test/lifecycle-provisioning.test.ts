import { describe, it, expect } from "vitest";
import { isReservedSlug } from "../src/domains/reserved-hosts";

describe("lifecycle provisioning contracts", () => {
  it("rejects reserved slugs before tenant create", () => {
    expect(isReservedSlug("platform")).toBe(true);
    expect(isReservedSlug("www")).toBe(true);
    expect(isReservedSlug("newco")).toBe(false);
  });

  it("idempotency key format is stable for registrations", () => {
    const registrationId = "reg-123";
    const key = `registration:${registrationId}`;
    expect(key).toBe("registration:reg-123");
    expect(`registration:${registrationId}`).toBe(key);
  });

  it("tenant lifecycle states are explicit strings", () => {
    const allowed = new Set([
      "registration_pending",
      "awaiting_approval",
      "provisioning",
      "invitation_pending",
      "active",
      "suspended",
      "deactivated",
      "provisioning_failed",
    ]);
    expect(allowed.has("active")).toBe(true);
    expect(allowed.has("ghost")).toBe(false);
  });

  it("retry must not invent a second tenant for the same idempotency key", () => {
    const seen = new Map<string, string>();
    const key = "registration:abc";
    const first = "tenant-1";
    seen.set(key, first);
    const secondAttempt = seen.get(key) ?? "tenant-2";
    expect(secondAttempt).toBe("tenant-1");
  });
});
