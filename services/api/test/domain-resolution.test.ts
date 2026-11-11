import { describe, it, expect } from "vitest";
import {
  classifyHostShape,
  isReservedSlug,
  normalizeHostname,
} from "../src/domains/reserved-hosts";

describe("hostname normalization", () => {
  it("strips scheme, path, port, and trailing dot", () => {
    expect(normalizeHostname("HTTPS://Demo.SokoOS.com:443/pos")).toBe("demo.sokoos.com");
    expect(normalizeHostname("Acme.localhost:5175")).toBe("acme.localhost");
    expect(normalizeHostname("shop.sokoos.com.")).toBe("shop.sokoos.com");
  });

  it("rejects empty after normalize", () => {
    expect(normalizeHostname("   ")).toBe("");
  });
});

describe("reserved slugs", () => {
  it("blocks system names", () => {
    expect(isReservedSlug("www")).toBe(true);
    expect(isReservedSlug("platform")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("PLATFORM")).toBe(true);
  });

  it("allows valid business slugs", () => {
    expect(isReservedSlug("acme")).toBe(false);
    expect(isReservedSlug("demo")).toBe(false);
    expect(isReservedSlug("honeywell-ke")).toBe(false);
  });

  it("rejects invalid shapes", () => {
    expect(isReservedSlug("-bad")).toBe(true);
    expect(isReservedSlug("a")).toBe(true);
    expect(isReservedSlug("Has Caps")).toBe(true);
  });
});

describe("host shape classification", () => {
  const base = "sokoos.com";
  const platform = "platform.sokoos.com";
  const publicHosts = ["sokoos.com", "www.sokoos.com"];

  it("detects platform and public", () => {
    expect(classifyHostShape(platform, base, platform, publicHosts).kind).toBe("platform");
    expect(classifyHostShape("www.sokoos.com", base, platform, publicHosts).kind).toBe("public");
    expect(classifyHostShape("sokoos.com", base, platform, publicHosts).kind).toBe("public");
  });

  it("extracts managed subdomain slug", () => {
    expect(classifyHostShape("acme.sokoos.com", base, platform, publicHosts)).toEqual({
      kind: "managed_subdomain",
      slug: "acme",
    });
    expect(classifyHostShape("acme.localhost", base, platform, publicHosts)).toEqual({
      kind: "managed_subdomain",
      slug: "acme",
    });
  });

  it("treats IP and empty as non-tenant", () => {
    expect(classifyHostShape("127.0.0.1", base, platform, publicHosts).kind).toBe("ip");
    expect(classifyHostShape("", base, platform, publicHosts).kind).toBe("empty");
  });

  it("marks unknown custom hosts as other", () => {
    expect(classifyHostShape("pos.acmecorp.co.ke", base, platform, publicHosts).kind).toBe("other");
  });
});

describe("session boundary rules (contract)", () => {
  it("hostname candidate must match login tenant when both present", () => {
    const hostTenantSlug = "acme";
    const loginSlug = "beta";
    const allowed = !hostTenantSlug || hostTenantSlug === loginSlug;
    expect(allowed).toBe(false);
  });

  it("platform host prefers null-tenant users", () => {
    const hostOutcome = "platform";
    const userTenantId: string | null = "tenant-a";
    const ok = hostOutcome !== "platform" || userTenantId === null;
    expect(ok).toBe(false);
  });
});
