import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "@sokoos/types";

export const PERMISSIONS_KEY = "permissions";

/** Require any of the listed permissions (OR). */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
