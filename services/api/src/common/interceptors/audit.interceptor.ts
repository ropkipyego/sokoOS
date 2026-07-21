import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../tenant-context";

/**
 * Lightweight audit interceptor — logs mutating HTTP methods to AuditLog.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      path: string;
      user?: AuthUser;
      headers: Record<string, string | undefined>;
    }>();

    const method = request.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next.handle();
    }

    // Skip noisy auth/health paths
    if (
      request.path.startsWith("/health") ||
      request.path.includes("/auth/login") ||
      request.path.includes("/auth/refresh")
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.writeAudit(request, method);
        },
      }),
    );
  }

  private async writeAudit(
    request: {
      method: string;
      path: string;
      user?: AuthUser;
      headers: Record<string, string | undefined>;
    },
    method: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: request.user?.tenantId ?? null,
          actorUserId: request.user?.id ?? null,
          deviceId: request.user?.deviceId ?? request.headers["x-device-id"] ?? null,
          action: `${method} ${request.path}`,
          entityType: "http_request",
          entityId: null,
          metadata: {
            method,
            path: request.path,
          },
        },
      });
    } catch {
      // Never fail the request because of audit write
    }
  }
}
