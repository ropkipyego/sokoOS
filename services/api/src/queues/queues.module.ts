import { DynamicModule, Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsProcessor } from "./notifications.processor";
import { SyncFanoutProcessor } from "./sync-fanout.processor";
import {
  NOTIFICATIONS_QUEUE,
  SYNC_FANOUT_QUEUE,
} from "./queue.constants";

/**
 * Registers BullMQ only when REDIS_URL is set.
 * When Redis is down, workers reconnect softly — API bootstrap is not blocked.
 */
@Module({})
export class QueuesModule {
  private static readonly logger = new Logger(QueuesModule.name);

  static forRoot(): DynamicModule {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      this.logger.log(
        "REDIS_URL unset — BullMQ queues disabled (API runs without workers)",
      );
      return {
        module: QueuesModule,
        global: true,
        providers: [],
        exports: [],
      };
    }

    this.logger.log("REDIS_URL set — registering BullMQ queues");

    return {
      module: QueuesModule,
      global: true,
      imports: [
        NotificationsModule,
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              url: config.get<string>("REDIS_URL", redisUrl),
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              retryStrategy: (times: number) =>
                Math.min(times * 500, 5000),
            },
          }),
        }),
        BullModule.registerQueue(
          { name: NOTIFICATIONS_QUEUE },
          { name: SYNC_FANOUT_QUEUE },
        ),
      ],
      providers: [NotificationsProcessor, SyncFanoutProcessor],
      exports: [BullModule],
    };
  }
}
