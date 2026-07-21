import type { LocalDb } from "./LocalDb";
import { MemoryLocalDb } from "./MemoryLocalDb";
import { SEED_PRODUCTS } from "./seed";

export type { LocalDb } from "./LocalDb";
export { MemoryLocalDb } from "./MemoryLocalDb";
export { SqliteLocalDb } from "./SqliteLocalDb";
export * from "./types";
export { SEED_PRODUCTS, SEED_CATEGORIES } from "./seed";

let dbSingleton: LocalDb | null = null;

export async function getLocalDb(): Promise<LocalDb> {
  if (dbSingleton) return dbSingleton;

  const db = new MemoryLocalDb({ persistKey: "sokoos.pos.localdb" });
  const existing = await db.listProducts();
  if (existing.length === 0) {
    await db.upsertProducts(SEED_PRODUCTS);
  }
  dbSingleton = db;
  return db;
}
