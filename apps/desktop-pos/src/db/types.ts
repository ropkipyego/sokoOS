export type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
};

export type SaleLineRecord = {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type SaleRecord = {
  id: string;
  receiptNo: string;
  branchId: string;
  tender: PaymentTender;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lines: SaleLineRecord[];
  createdAt: string;
  synced: boolean;
};

export type StockMovementRecord = {
  id: string;
  productId: string;
  delta: number;
  reason: "sale" | "adjustment" | "receive";
  saleId?: string;
  createdAt: string;
};

export type OutboxRecord = {
  id: string;
  entityType: "sale" | "stock_movement";
  entityId: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export type PaymentTender = "cash" | "mpesa" | "card";

export type CompleteSaleInput = {
  branchId: string;
  tender: PaymentTender;
  lines: Array<{
    productId: string;
    qty: number;
  }>;
};
