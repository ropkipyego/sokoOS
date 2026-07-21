export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw result.error instanceof Error
      ? result.error
      : new Error(String(result.error));
  }
  return result.value;
}

export type AppErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "TENANT_MISMATCH"
  | "INTERNAL"
  | "UNAVAILABLE";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;
  readonly status: number;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.status = statusForCode(code);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError("VALIDATION", message, details);
  }

  static notFound(message: string, details?: unknown): AppError {
    return new AppError("NOT_FOUND", message, details);
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError("UNAUTHORIZED", message);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError("FORBIDDEN", message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError("CONFLICT", message, details);
  }

  static tenantMismatch(message = "Tenant mismatch"): AppError {
    return new AppError("TENANT_MISMATCH", message);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      status: this.status,
    };
  }
}

function statusForCode(code: AppErrorCode): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "TENANT_MISMATCH":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}

/** Default system roles from SRS REQ-RBAC-001. */
export const SystemRole = {
  PlatformOwner: "platform_owner",
  BusinessOwner: "business_owner",
  RegionalManager: "regional_manager",
  BranchManager: "branch_manager",
  Supervisor: "supervisor",
  Cashier: "cashier",
  InventoryOfficer: "inventory_officer",
  PurchasingOfficer: "purchasing_officer",
  Accountant: "accountant",
  Auditor: "auditor",
  Customer: "customer",
  Supplier: "supplier",
} as const;

export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

export const SYSTEM_ROLE_KEYS = Object.values(SystemRole);
