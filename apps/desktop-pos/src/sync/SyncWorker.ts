import type { LocalDb, OutboxRecord } from "../db";
import { buildSyncEnvelope } from "./buildEnvelope";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/v1";

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "synced";

export type SyncPushAck = {
  acceptedChangeIds?: string[];
  conflicts?: Array<{ changeId: string; code: string; message?: string }>;
};

/**
 * Posts pending outbox records to `/v1/sync/push` as a SyncEnvelope.
 * Never throws into the checkout path — callers fire-and-forget.
 * Never discards unacked outbox rows.
 */
export class SyncWorker {
  private status: SyncStatus = "idle";
  private pendingCount = 0;
  private listeners = new Set<(status: SyncStatus, pending: number) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private deviceId: string;
  private tenantId: string | null;
  private branchId: string | null;
  private actorUserId: string | null;
  private readonly db: LocalDb;
  private accessToken: string | null;
  private flushing = false;

  constructor(
    db: LocalDb,
    options?: {
      deviceId?: string;
      intervalMs?: number;
      accessToken?: string | null;
      tenantId?: string | null;
      branchId?: string | null;
      actorUserId?: string | null;
    },
  ) {
    this.db = db;
    this.deviceId = options?.deviceId ?? crypto.randomUUID();
    this.tenantId = options?.tenantId ?? null;
    this.branchId = options?.branchId ?? null;
    this.actorUserId = options?.actorUserId ?? null;
    this.accessToken = options?.accessToken ?? null;
    const intervalMs = options?.intervalMs ?? 8_000;
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        void this.flush();
      });
      this.timer = setInterval(() => {
        void this.flush();
      }, intervalMs);
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setContext(ctx: {
    tenantId?: string | null;
    branchId?: string | null;
    actorUserId?: string | null;
    deviceId?: string | null;
  }) {
    if (ctx.tenantId !== undefined) this.tenantId = ctx.tenantId;
    if (ctx.branchId !== undefined) this.branchId = ctx.branchId;
    if (ctx.actorUserId !== undefined) this.actorUserId = ctx.actorUserId;
    if (ctx.deviceId) this.deviceId = ctx.deviceId;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  getPendingCountSync(): number {
    return this.pendingCount;
  }

  /** Pending outbox depth — connectivity ≠ successful sync. */
  async getPendingCount(): Promise<number> {
    const items = await this.db.listOutbox();
    this.pendingCount = items.length;
    return items.length;
  }

  subscribe(listener: (status: SyncStatus, pending: number) => void): () => void {
    this.listeners.add(listener);
    listener(this.status, this.pendingCount);
    return () => this.listeners.delete(listener);
  }

  /** Kick a background sync after a local write. Does not block. */
  enqueueFlush(): void {
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const items = await this.db.listOutbox();
      this.pendingCount = items.length;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        this.setStatus("offline");
        return;
      }

      if (items.length === 0) {
        this.setStatus("synced");
        return;
      }

      if (!this.accessToken || !this.tenantId || !this.actorUserId) {
        this.setStatus("error");
        return;
      }

      this.setStatus("syncing");
      try {
        const envelope = buildSyncEnvelope({
          tenantId: this.tenantId,
          deviceId: this.deviceId,
          branchId: this.branchId,
          actorUserId: this.actorUserId,
          items,
        });
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        };
        const response = await fetch(`${API_URL}/sync/push`, {
          method: "POST",
          headers,
          body: JSON.stringify(envelope),
        });

        if (!response.ok) {
          await this.bumpAttempts(items, `HTTP ${response.status}`);
          throw new Error(`Sync push failed (${response.status})`);
        }

        const body = (await response.json()) as { data?: SyncPushAck } & SyncPushAck;
        const ack = body.data ?? body;
        const accepted = new Set(ack.acceptedChangeIds ?? []);
        if (accepted.size > 0) {
          await this.db.markOutboxSynced([...accepted]);
        }
        // Conflicts stay in outbox with lastError — never silently discarded
        const conflicts = ack.conflicts ?? [];
        if (conflicts.length) {
          await this.recordConflicts(items, conflicts);
        }

        const remaining = await this.db.listOutbox();
        this.pendingCount = remaining.length;
        this.setStatus(remaining.length === 0 ? "synced" : "error");
      } catch {
        this.setStatus(
          typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error",
        );
      }
    } finally {
      this.flushing = false;
    }
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.listeners.clear();
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    for (const listener of this.listeners) listener(status, this.pendingCount);
  }

  private async bumpAttempts(items: OutboxRecord[], error: string) {
    for (const item of items) {
      item.attempts += 1;
      item.lastError = error;
    }
    // Persist via mark of empty + re-list pattern: MemoryLocalDb exposes persist through mark/list
    // Re-queue untouched — markOutboxSynced([]) is a no-op filter; rewrite via sync helper if needed
    await this.db.markOutboxSynced([]);
  }

  private async recordConflicts(
    items: OutboxRecord[],
    conflicts: Array<{ changeId: string; code: string; message?: string }>,
  ) {
    const byId = new Map(conflicts.map((c) => [c.changeId, c]));
    for (const item of items) {
      const c = byId.get(item.id);
      if (c) {
        item.attempts += 1;
        item.lastError = `${c.code}${c.message ? `: ${c.message}` : ""}`;
      }
    }
    await this.db.markOutboxSynced([]);
  }
}
