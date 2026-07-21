import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { randomUUID } from "node:crypto";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      headers: Record<string, string | undefined>;
      requestId?: string;
    }>();
    const response = http.getResponse<{ setHeader: (k: string, v: string) => void }>();

    const requestId =
      request.headers["x-request-id"]?.trim() || randomUUID();
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);

    return next.handle().pipe(tap(() => undefined));
  }
}
