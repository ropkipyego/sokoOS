import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { SYNC_FANOUT_QUEUE, type SyncFanoutJob } from "./queue.constants";

/**
 * Placeholder post-sync fanout worker.
 * Future: catalog refresh hints, report invalidation, push fanout metrics.
 */
@Processor(SYNC_FANOUT_QUEUE)
export class SyncFanoutProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncFanoutProcessor.name);

  async process(job: Job<SyncFanoutJob>): Promise<void> {
    const { tenantId, acceptedChangeIds, serverSeq } = job.data;
    this.logger.log(
      `sync-fanout tenant=${tenantId} changes=${acceptedChangeIds.length} serverSeq=${serverSeq} job=${job.id}`,
    );
  }
}
