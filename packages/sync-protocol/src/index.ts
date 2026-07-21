import {
  SyncChangeSchema,
  SyncEnvelopeSchema,
  type SyncChange,
  type SyncEnvelope,
} from "@sokoos/types";

export { SyncChangeSchema, SyncEnvelopeSchema };
export type { SyncChange, SyncEnvelope };

/** Local outbox / change lifecycle. */
export const SyncStatus = {
  Pending: "pending",
  Syncing: "syncing",
  Synced: "synced",
  Failed: "failed",
  Conflict: "conflict",
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const SYNC_STATUSES = Object.values(SyncStatus);

/** Machine-readable conflict / rejection codes from cloud ingest. */
export const ConflictCode = {
  VersionMismatch: "VERSION_MISMATCH",
  ImmutableDuplicate: "IMMUTABLE_DUPLICATE",
  PayloadHashMismatch: "PAYLOAD_HASH_MISMATCH",
  TenantMismatch: "TENANT_MISMATCH",
  BranchUnauthorized: "BRANCH_UNAUTHORIZED",
  ProtocolUnsupported: "PROTOCOL_UNSUPPORTED",
  EntityUnknown: "ENTITY_UNKNOWN",
  AuthzRejected: "AUTHZ_REJECTED",
  ValidationFailed: "VALIDATION_FAILED",
  DeviceDisabled: "DEVICE_DISABLED",
} as const;
export type ConflictCode = (typeof ConflictCode)[keyof typeof ConflictCode];

export const CURRENT_PROTOCOL_VERSION = 1 as const;

export type SyncPushAck = {
  acceptedChangeIds: string[];
  conflicts: Array<{
    changeId: string;
    entityType: string;
    entityId: string;
    code: ConflictCode;
    message?: string;
  }>;
  serverSeq: number;
  skewWarning?: boolean;
};

export type SyncPullRequest = {
  deviceId: string;
  tenantId: string;
  serverSeq: number;
  limit?: number;
  mode?: "incremental" | "snapshot";
};

export type SyncPullResponse = {
  changes: SyncChange[];
  serverSeq: number;
  hasMore: boolean;
};

/**
 * Compare entity versions for upsert conflict detection.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareVersions(a: number, b: number): number {
  return a - b;
}

/** True when the incoming change should win a LWW upsert (higher version). */
export function isNewerVersion(incoming: number, current: number): boolean {
  return incoming > current;
}

/**
 * Validate baseVersion gate for mid-air collision detection.
 * Create uses baseVersion 0; updates must match server.version.
 */
export function acceptsBaseVersion(
  serverVersion: number,
  baseVersion: number | undefined,
): boolean {
  if (baseVersion === undefined) {
    return true;
  }
  return serverVersion === baseVersion;
}

/** Next monotonic version after a successful mutation. */
export function nextVersion(current: number): number {
  if (!Number.isInteger(current) || current < 0) {
    throw new RangeError(`Invalid version: ${current}`);
  }
  return current + 1;
}

export function isSupportedProtocolVersion(version: number): boolean {
  return version === CURRENT_PROTOCOL_VERSION;
}
