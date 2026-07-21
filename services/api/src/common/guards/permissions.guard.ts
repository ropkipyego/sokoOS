import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PERMISSIONS_KEY,
  IS_PUBLIC_KEY,
} from "../decorators/permissions.decorator";
import type { AuthUser } from "../tenant-context";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const allowed = required.some((perm) => user.permissions.includes(perm));
    if (!allowed) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: `Missing permission: ${required.join(" | ")}`,
        details: required.map((p) => ({
          path: "permission",
          message: p,
          code: "missing_permission",
        })),
      });
    }
    return true;
  }
}

/** Pure helper for unit tests — checks if user perms satisfy required (OR). */
export function hasAnyPermission(
  userPermissions: readonly string[],
  required: readonly string[],
): boolean {
  if (required.length === 0) return true;
  return required.some((p) => userPermissions.includes(p));
}
