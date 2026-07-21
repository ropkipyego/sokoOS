export type CursorPageMeta = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor<T extends Record<string, unknown>>(
  cursor: string | undefined,
): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }
}

export function paginateMeta(
  hasMore: boolean,
  limit: number,
  nextCursor: string | null,
): CursorPageMeta {
  return { nextCursor: hasMore ? nextCursor : null, hasMore, limit };
}
