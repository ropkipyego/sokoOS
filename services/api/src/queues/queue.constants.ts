export const NOTIFICATIONS_QUEUE = "notifications";
export const SYNC_FANOUT_QUEUE = "sync-fanout";

export type CreateNotificationJob = {
  tenantId: string;
  userId: string;
  type: string;
  body: string;
};

export type SyncFanoutJob = {
  tenantId: string;
  acceptedChangeIds: string[];
  serverSeq: number;
  deviceId?: string;
};
