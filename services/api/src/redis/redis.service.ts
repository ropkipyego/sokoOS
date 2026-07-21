import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>(
      "REDIS_URL",
      "redis://localhost:6379",
    );

    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });

    this.client.on("error", (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });

    void this.client.connect().catch((err: Error) => {
      this.logger.warn(
        `Redis unavailable at startup (${err.message}) — continuing without cache/queues`,
      );
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  /** Soft ping for readiness — never throws. */
  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (this.client.status !== "ready") {
        // Attempt a quick reconnect for health probes
        if (this.client.status === "wait" || this.client.status === "end") {
          await this.client.connect().catch(() => undefined);
        }
      }
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }
}
