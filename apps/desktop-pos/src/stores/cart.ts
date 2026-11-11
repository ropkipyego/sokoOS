import { create } from "zustand";
import type { PaymentTender, ProductRecord, SaleRecord } from "../db";

export type CartLine = {
  productId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
  qty: number;
};

type CartState = {
  lines: CartLine[];
  tender: PaymentTender;
  cashTenderedCents: number;
  lastSale: SaleRecord | null;
  paySuccessPulse: boolean;
  addProduct: (product: ProductRecord, maxStock?: number) => void;
  setQty: (productId: string, qty: number, maxStock?: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
  setTender: (tender: PaymentTender) => void;
  setCashTendered: (cents: number) => void;
  setLastSale: (sale: SaleRecord | null) => void;
  triggerPaySuccess: () => void;
};

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  tender: "cash",
  cashTenderedCents: 0,
  lastSale: null,
  paySuccessPulse: false,

  addProduct: (product, maxStock) => {
    const existing = get().lines.find((line) => line.productId === product.id);
    const nextQty = (existing?.qty ?? 0) + 1;
    if (typeof maxStock === "number" && maxStock >= 0 && nextQty > maxStock) return;
    if (existing) {
      set({
        lines: get().lines.map((line) =>
          line.productId === product.id ? { ...line, qty: nextQty } : line,
        ),
      });
      return;
    }
    set({
      lines: [
        ...get().lines,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPriceCents: product.priceCents,
          qty: 1,
        },
      ],
    });
  },

  setQty: (productId, qty, maxStock) => {
    if (qty <= 0) {
      get().removeLine(productId);
      return;
    }
    const capped = typeof maxStock === "number" && maxStock >= 0 ? Math.min(qty, maxStock) : qty;
    set({
      lines: get().lines.map((line) => (line.productId === productId ? { ...line, qty: capped } : line)),
    });
  },

  removeLine: (productId) => {
    set({ lines: get().lines.filter((line) => line.productId !== productId) });
  },

  clear: () => set({ lines: [], cashTenderedCents: 0, tender: "cash" }),

  setTender: (tender) => set({ tender }),
  setCashTendered: (cents) => set({ cashTenderedCents: cents }),

  setLastSale: (sale) => set({ lastSale: sale }),

  triggerPaySuccess: () => {
    set({ paySuccessPulse: true });
    window.setTimeout(() => set({ paySuccessPulse: false }), 420);
  },
}));

export function cartTotals(lines: CartLine[]) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);
  const taxCents = 0;
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function formatMoney(cents: number, currency = "KES"): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
