import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  SYNC_FANOUT_QUEUE,
  type SyncFanoutJob,
} from "../queues/queue.constants";
import { SyncGateway } from "./sync.gateway";

/**
 * Best-effort post-sync fanout: enqueue BullMQ job + WebSocket notify.
 * Safe when Redis/queues are absent.
 */
@Injectable()
export class SyncFanoutPublisher {
  private readonly logger = new Logger(SyncFanoutPublisher.name);

  constructor(
    @Optional()
    @Inject(getQueueToken(SYNC_FANOUT_QUEUE))
    private readonly queue: Queue<SyncFanoutJob> | null,
    @Optional() private readonly gateway: SyncGateway | null,
  ) {}

  async afterPushAccepted(job: SyncFanoutJob): Promise<void> {
    if (this.queue) {
      try {
        await this.queue.add("fanout", job, {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 2,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`sync-fanout enqueue skipped: ${message}`);
      }
    }

    try {
      this.gateway?.notifyTenant(job.tenantId, {
        serverSeq: job.serverSeq,
        acceptedChangeIds: job.acceptedChangeIds,
        deviceId: job.deviceId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sync WS notify skipped: ${message}`);
    }
  }
}
