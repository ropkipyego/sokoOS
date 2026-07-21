import {
  Injectable,
  Scope,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  sessionId: string;
  authzVersion: number;
  deviceId?: string;
  permissions: string[];
};

/**
 * Request-scoped tenant / actor context derived from the JWT.
 * All tenant-scoped queries MUST use tenantId from this context.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private user: AuthUser | null = null;
  private branchId: string | null = null;
  private requestId: string | null = null;

  setUser(user: AuthUser): void {
    this.user = user;
  }

  setBranchId(branchId: string | null): void {
    this.branchId = branchId;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  getRequestId(): string | null {
    return this.requestId;
  }

  getUser(): AuthUser {
    if (!this.user) {
      throw new UnauthorizedException("Not authenticated");
    }
    return this.user;
  }

  tryGetUser(): AuthUser | null {
    return this.user;
  }

  /** Tenant id from JWT — never trust client-supplied tenantId. */
  requireTenantId(): string {
    const user = this.getUser();
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant context required");
    }
    return user.tenantId;
  }

  tryTenantId(): string | null {
    return this.user?.tenantId ?? null;
  }

  getBranchId(): string | null {
    return this.branchId;
  }

  hasPermission(key: string): boolean {
    const user = this.tryGetUser();
    if (!user) return false;
    return user.permissions.includes(key);
  }
}
