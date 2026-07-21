import type { LocalDb } from "./LocalDb";
import type {
  CompleteSaleInput,
  OutboxRecord,
  ProductRecord,
  SaleRecord,
  StockMovementRecord,
} from "./types";

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * In-memory adapter with optional localStorage durability for browser demos.
 * Swap for SqliteLocalDb when a native SQLite bridge is available.
 */
export class MemoryLocalDb implements LocalDb {
  private products = new Map<string, ProductRecord>();
  private sales: SaleRecord[] = [];
  private movements: StockMovementRecord[] = [];
  private outbox: OutboxRecord[] = [];
  private receiptSeq = 1000;
  private readonly storageKey?: string;

  constructor(options?: { persistKey?: string }) {
    this.storageKey = options?.persistKey;
    this.hydrate();
  }

  async listProducts(): Promise<ProductRecord[]> {
    return [...this.products.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProduct(productId: string): Promise<ProductRecord | undefined> {
    const product = this.products.get(productId);
    return product ? { ...product } : undefined;
  }

  async upsertProducts(products: ProductRecord[]): Promise<void> {
    for (const product of products) {
      this.products.set(product.id, { ...product });
    }
    this.persist();
  }

  async listSales(): Promise<SaleRecord[]> {
    return [...this.sales];
  }

  async listOutbox(): Promise<OutboxRecord[]> {
    return [...this.outbox];
  }

  async listStockMovements(): Promise<StockMovementRecord[]> {
    return [...this.movements];
  }

  async markOutboxSynced(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.outbox = this.outbox.filter((item) => !idSet.has(item.id));
    for (const sale of this.sales) {
      if (idSet.has(`outbox_sale_${sale.id}`)) {
        sale.synced = true;
      }
    }
    // Also mark by entity linkage
    for (const sale of this.sales) {
      if (ids.some((outboxId) => outboxId.includes(sale.id))) {
        sale.synced = true;
      }
    }
    this.persist();
  }

  async completeSale(input: CompleteSaleInput): Promise<SaleRecord> {
    if (input.lines.length === 0) {
      throw new Error("Cart is empty");
    }

    const lines = [];
    let subtotalCents = 0;

    for (const line of input.lines) {
      const product = this.products.get(line.productId);
      if (!product) throw new Error(`Unknown product ${line.productId}`);
      if (line.qty <= 0) throw new Error("Quantity must be positive");
      if (product.stock < line.qty) throw new Error(`Insufficient stock for ${product.name}`);

      const lineTotalCents = product.priceCents * line.qty;
      subtotalCents += lineTotalCents;
      lines.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty: line.qty,
        unitPriceCents: product.priceCents,
        lineTotalCents,
      });
    }

    const taxCents = 0;
    const totalCents = subtotalCents + taxCents;
    const saleId = id("sale");
    const createdAt = new Date().toISOString();
    this.receiptSeq += 1;

    const sale: SaleRecord = {
      id: saleId,
      receiptNo: `R-${this.receiptSeq}`,
      branchId: input.branchId,
      tender: input.tender,
      subtotalCents,
      taxCents,
      totalCents,
      lines,
      createdAt,
      synced: false,
    };

    // Apply stock + movements + outbox in one local transaction (in-memory)
    for (const line of lines) {
      const product = this.products.get(line.productId);
      if (!product) continue;
      product.stock -= line.qty;
      this.products.set(product.id, product);

      const movement: StockMovementRecord = {
        id: id("mv"),
        productId: product.id,
        delta: -line.qty,
        reason: "sale",
        saleId,
        createdAt,
      };
      this.movements.push(movement);
      this.outbox.push({
        id: id("outbox"),
        entityType: "stock_movement",
        entityId: movement.id,
        payload: movement,
        createdAt,
        attempts: 0,
      });
    }

    this.sales.unshift(sale);
    this.outbox.push({
      id: id("outbox"),
      entityType: "sale",
      entityId: sale.id,
      payload: sale,
      createdAt,
      attempts: 0,
    });

    this.persist();
    return sale;
  }

  private hydrate() {
    if (!this.storageKey || typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        products?: ProductRecord[];
        sales?: SaleRecord[];
        movements?: StockMovementRecord[];
        outbox?: OutboxRecord[];
        receiptSeq?: number;
      };
      for (const product of parsed.products ?? []) {
        this.products.set(product.id, product);
      }
      this.sales = parsed.sales ?? [];
      this.movements = parsed.movements ?? [];
      this.outbox = parsed.outbox ?? [];
      this.receiptSeq = parsed.receiptSeq ?? 1000;
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persist() {
    if (!this.storageKey || typeof localStorage === "undefined") return;
    const payload = {
      products: [...this.products.values()],
      sales: this.sales,
      movements: this.movements,
      outbox: this.outbox,
      receiptSeq: this.receiptSeq,
    };
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }
}
