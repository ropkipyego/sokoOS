import { describe, it, expect } from "vitest";
import {
  decideSyncIdempotency,
  hashPayload,
} from "../src/sync/sync.service";

describe("sync idempotency handler", () => {
  it("accepts a new changeId", () => {
    const decision = decideSyncIdempotency(null, hashPayload({ a: 1 }));
    expect(decision).toBe("accept_new");
  });

  it("replays when changeId exists with same payload hash", () => {
    const hash = hashPayload({ entity: "sale", total: 100 });
    const decision = decideSyncIdempotency({ payloadHash: hash }, hash);
    expect(decision).toBe("replay");
  });

  it("flags hash mismatch when changeId reused with different payload", () => {
    const original = hashPayload({ qty: 1 });
    const incoming = hashPayload({ qty: 2 });
    const decision = decideSyncIdempotency(
      { payloadHash: original },
      incoming,
    );
    expect(decision).toBe("hash_mismatch");
  });

  it("replays when stored hash is null (legacy row)", () => {
    const decision = decideSyncIdempotency(
      { payloadHash: null },
      hashPayload({ x: true }),
    );
    expect(decision).toBe("replay");
  });
});
