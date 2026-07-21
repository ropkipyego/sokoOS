import type { LocalDb } from "./LocalDb";
import type {
  CompleteSaleInput,
  OutboxRecord,
  ProductRecord,
  SaleRecord,
  StockMovementRecord,
} from "./types";

/**
 * Stub for a future sql.js / better-sqlite3 / Electron native SQLite adapter.
 * Implements LocalDb so call sites can swap adapters without rewriting sale flow.
 */
export class SqliteLocalDb implements LocalDb {
  constructor(_dbPath?: string) {
    // Intentionally unimplemented — wire sql.js or native SQLite here.
  }

  async listProducts(): Promise<ProductRecord[]> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }

  async getProduct(_id: string): Promise<ProductRecord | undefined> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }

  async upsertProducts(_products: ProductRecord[]): Promise<void> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }

  async listSales(): Promise<SaleRecord[]> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }

  async listOutbox(): Promise<OutboxRecord[]> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }

  async markOutboxSynced(_ids: string[]): Promise<void> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }

  async completeSale(_input: CompleteSaleInput): Promise<SaleRecord> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }

  async listStockMovements(): Promise<StockMovementRecord[]> {
    throw new Error("SqliteLocalDb is a stub — use MemoryLocalDb for demos");
  }
}
