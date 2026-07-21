import { describe, it, expect, vi } from "vitest";
import { NotificationsProcessor } from "../src/queues/notifications.processor";
import { SyncFanoutProcessor } from "../src/queues/sync-fanout.processor";
import {
  NOTIFICATIONS_QUEUE,
  SYNC_FANOUT_QUEUE,
} from "../src/queues/queue.constants";
import { QueuesModule } from "../src/queues/queues.module";
import type { NotificationsService } from "../src/notifications/notifications.service";
import type { Job } from "bullmq";
import type { CreateNotificationJob, SyncFanoutJob } from "../src/queues/queue.constants";

describe("queues module + processors", () => {
  it("exports queue name constants", () => {
    expect(NOTIFICATIONS_QUEUE).toBe("notifications");
    expect(SYNC_FANOUT_QUEUE).toBe("sync-fanout");
  });

  it("QueuesModule.forRoot returns a dynamic module", () => {
    const prev = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    const mod = QueuesModule.forRoot();
    expect(mod.module).toBe(QueuesModule);
    expect(mod.global).toBe(true);
    if (prev !== undefined) process.env.REDIS_URL = prev;
  });

  it("NotificationsProcessor can be constructed and creates rows", async () => {
    const create = vi.fn().mockResolvedValue({ id: "n1" });
    const notifications = { create } as unknown as NotificationsService;
    const processor = new NotificationsProcessor(notifications);

    await processor.process({
      id: "job-1",
      data: {
        tenantId: "t1",
        userId: "u1",
        type: "sync",
        body: "hello",
      },
    } as Job<CreateNotificationJob>);

    expect(create).toHaveBeenCalledWith("t1", "u1", {
      type: "sync",
      body: "hello",
    });
  });

  it("SyncFanoutProcessor can be constructed and processes jobs", async () => {
    const processor = new SyncFanoutProcessor();
    await expect(
      processor.process({
        id: "job-2",
        data: {
          tenantId: "t1",
          acceptedChangeIds: ["c1"],
          serverSeq: 10,
        },
      } as Job<SyncFanoutJob>),
    ).resolves.toBeUndefined();
  });
});
