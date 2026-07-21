import { v7 as uuidv7FromPackage } from "uuid";

/**
 * Generate a UUIDv7 string (time-ordered). Preferred for syncable entity ids.
 */
export function uuidv7(): string {
  return uuidv7FromPackage();
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
