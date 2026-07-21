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
  lastSale: SaleRecord | null;
  paySuccessPulse: boolean;
  addProduct: (product: ProductRecord) => void;
  setQty: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
  setTender: (tender: PaymentTender) => void;
  setLastSale: (sale: SaleRecord | null) => void;
  triggerPaySuccess: () => void;
};

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  tender: "cash",
  lastSale: null,
  paySuccessPulse: false,

  addProduct: (product) => {
    const existing = get().lines.find((line) => line.productId === product.id);
    if (existing) {
      set({
        lines: get().lines.map((line) =>
          line.productId === product.id ? { ...line, qty: line.qty + 1 } : line,
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

  setQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeLine(productId);
      return;
    }
    set({
      lines: get().lines.map((line) => (line.productId === productId ? { ...line, qty } : line)),
    });
  },

  removeLine: (productId) => {
    set({ lines: get().lines.filter((line) => line.productId !== productId) });
  },

  clear: () => set({ lines: [] }),

  setTender: (tender) => set({ tender }),

  setLastSale: (sale) => set({ lastSale: sale }),

  triggerPaySuccess: () => {
    set({ paySuccessPulse: true });
    window.setTimeout(() => set({ paySuccessPulse: false }), 320);
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
