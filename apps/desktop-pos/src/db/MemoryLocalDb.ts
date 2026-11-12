import type { LocalDb } from "./LocalDb";
import type {
  CompleteSaleInput,
  OutboxRecord,
  ProductRecord,
  SaleRecord,
  StockMovementRecord,
} from "./types";

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
    const syncedEntityIds = new Set(
      this.outbox.filter((row) => idSet.has(row.id)).map((row) => row.entityId),
    );
    this.outbox = this.outbox.filter((item) => !idSet.has(item.id));
    for (const sale of this.sales) {
      if (syncedEntityIds.has(sale.id)) sale.synced = true;
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
      if (!product) {
        throw new Error(`Unknown product ${line.productId}`);
      }
      if (product.stock < line.qty) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      const lineTotal = product.priceCents * line.qty;
      subtotalCents += lineTotal;
      lines.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty: line.qty,
        unitPriceCents: product.priceCents,
        lineTotalCents: lineTotal,
      });
    }

    const taxCents = 0;
    const totalCents = subtotalCents + taxCents;
    const saleId = crypto.randomUUID();
    const changeId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.receiptSeq += 1;

    const tenderMethod =
      input.tender === "mpesa"
        ? "mobile_money"
        : input.tender === "credit"
          ? "credit"
          : input.tender;

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
      cashTenderedCents: input.cashTenderedCents,
      changeCents:
        input.tender === "cash" && input.cashTenderedCents != null
          ? Math.max(0, input.cashTenderedCents - totalCents)
          : undefined,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
    };

    // Local stock + movements for UI/offline continuity (sale sync applies server stock)
    for (const line of lines) {
      const product = this.products.get(line.productId);
      if (!product) continue;
      product.stock -= line.qty;
      this.products.set(product.id, product);

      const movement: StockMovementRecord = {
        id: crypto.randomUUID(),
        productId: product.id,
        delta: -line.qty,
        reason: "sale",
        saleId,
        createdAt,
      };
      this.movements.push(movement);
    }

    this.sales.unshift(sale);

    // Only enqueue the sale — server sales.create deducts inventory (avoid double movement)
    this.outbox.push({
      id: changeId,
      entityType: "sale",
      entityId: saleId,
      payload: {
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        customerId: input.customerId,
        receiptNumber: sale.receiptNo,
        currency: input.currency ?? "KES",
        departmentId: input.departmentId,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          unitPriceMinor: l.unitPriceCents,
        })),
        payments: [
          {
            method: tenderMethod,
            amountMinor: totalCents,
            tenderedMinor:
              input.tender === "cash" ? input.cashTenderedCents : undefined,
            changeMinor:
              input.tender === "cash" && input.cashTenderedCents != null
                ? Math.max(0, input.cashTenderedCents - totalCents)
                : undefined,
            status: input.tender === "mpesa" ? "pending" : "completed",
          },
        ],
      },
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
      // Drop legacy non-UUID outbox rows that cannot sync under SyncEnvelope schema
      this.outbox = (parsed.outbox ?? []).filter((row) => {
        const uuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuid.test(row.id) && uuid.test(row.entityId);
      });
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
