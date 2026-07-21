import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { NotificationsService } from "../notifications/notifications.service";
import {
  NOTIFICATIONS_QUEUE,
  type CreateNotificationJob,
} from "./queue.constants";

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<CreateNotificationJob>): Promise<void> {
    const { tenantId, userId, type, body } = job.data;
    this.logger.debug(
      `Creating notification job=${job.id} type=${type} user=${userId}`,
    );
    await this.notifications.create(tenantId, userId, { type, body });
  }
}
