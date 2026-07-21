import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { JwtPayload } from "../auth/jwt.strategy";

const CLIENT_EVENT = "sync.available";

@WebSocketGateway({
  namespace: "/sync",
  cors: { origin: true, credentials: true },
})
export class SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SyncGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>(
          "JWT_ACCESS_SECRET",
          "change-me-access-secret-min-32-chars",
        ),
      });

      if (payload.typ !== "access" || !payload.tenant_id) {
        client.disconnect(true);
        return;
      }

      const room = this.tenantRoom(payload.tenant_id);
      await client.join(room);
      client.data.tenantId = payload.tenant_id;
      client.data.userId = payload.sub;
      this.logger.debug(`WS connected user=${payload.sub} room=${room}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WS auth failed: ${message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS disconnected ${client.id}`);
  }

  /**
   * Best-effort tenant broadcast. Never throws to callers.
   */
  notifyTenant(tenantId: string, event: unknown): void {
    try {
      if (!this.server) return;
      this.server
        .to(this.tenantRoom(tenantId))
        .emit(CLIENT_EVENT, event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`notifyTenant failed: ${message}`);
    }
  }

  private tenantRoom(tenantId: string): string {
    return `tenant:${tenantId}`;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token && typeof auth.token === "string") {
      return auth.token;
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice(7);
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === "string") return queryToken;
    return null;
  }
}
