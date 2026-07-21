import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "../tenant-context";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new Error("Tenant id missing from token");
    }
    return tenantId;
  },
);

export const BranchId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      query: Record<string, string | undefined>;
    }>();
    return (
      request.headers["x-branch-id"] ??
      request.query.branchId ??
      undefined
    );
  },
);

export const RequestId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      requestId?: string;
    }>();
    return (
      request.requestId ??
      request.headers["x-request-id"] ??
      "unknown"
    );
  },
);
