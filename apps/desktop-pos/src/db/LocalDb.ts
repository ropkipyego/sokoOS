import type {
  CompleteSaleInput,
  OutboxRecord,
  ProductRecord,
  SaleRecord,
  StockMovementRecord,
} from "./types";

/**
 * Local persistence contract for the POS.
 * MemoryLocalDb is the default demo adapter; SqliteLocalDb is a stub for native builds.
 */
export interface LocalDb {
  listProducts(): Promise<ProductRecord[]>;
  getProduct(id: string): Promise<ProductRecord | undefined>;
  upsertProducts(products: ProductRecord[]): Promise<void>;
  listSales(): Promise<SaleRecord[]>;
  listOutbox(): Promise<OutboxRecord[]>;
  markOutboxSynced(ids: string[]): Promise<void>;
  completeSale(input: CompleteSaleInput): Promise<SaleRecord>;
  listStockMovements(): Promise<StockMovementRecord[]>;
}
