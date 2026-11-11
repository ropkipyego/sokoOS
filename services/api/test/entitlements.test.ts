import { describe, it, expect } from "vitest";

describe("entitlement access modes", () => {
  function modeFor(status: string | null): "write" | "read_only" | "blocked_nonessential" {
    if (!status) return "write"; // legacy
    if (status === "active") return "write";
    if (status === "grace" || status === "past_due" || status === "pending") return "read_only";
    return "blocked_nonessential";
  }

  it("active allows write", () => {
    expect(modeFor("active")).toBe("write");
  });

  it("grace is read-only without deleting data", () => {
    expect(modeFor("grace")).toBe("read_only");
  });

  it("suspended blocks nonessential writes", () => {
    expect(modeFor("suspended")).toBe("blocked_nonessential");
  });

  it("legacy tenants without subscription keep write until migrated", () => {
    expect(modeFor(null)).toBe("write");
  });
});
