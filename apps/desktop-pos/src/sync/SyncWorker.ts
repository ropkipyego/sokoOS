import type { LocalDb, OutboxRecord } from "../db";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/v1";

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "synced";

export type SyncPushPayload = {
  deviceId: string;
  items: OutboxRecord[];
};

/**
 * Posts pending outbox records to `/v1/sync/push`.
 * Never throws into the checkout path — callers fire-and-forget.
 */
export class SyncWorker {
  private status: SyncStatus = "idle";
  private listeners = new Set<(status: SyncStatus) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly deviceId: string;
  private readonly db: LocalDb;

  constructor(db: LocalDb, options?: { deviceId?: string; intervalMs?: number }) {
    this.db = db;
    this.deviceId = options?.deviceId ?? "pos-demo-device";
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

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /** Kick a background sync after a local write. Does not block. */
  enqueueFlush(): void {
    void this.flush();
  }

  async flush(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setStatus("offline");
      return;
    }

    const items = await this.db.listOutbox();
    if (items.length === 0) {
      this.setStatus("synced");
      return;
    }

    this.setStatus("syncing");
    try {
      const payload: SyncPushPayload = { deviceId: this.deviceId, items };
      const response = await fetch(`${API_URL}/sync/push`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Sync push failed (${response.status})`);
      }

      await this.db.markOutboxSynced(items.map((item) => item.id));
      this.setStatus("synced");
    } catch {
      // Demo / offline-tolerant: leave outbox intact for next attempt.
      this.setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    }
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.listeners.clear();
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}
