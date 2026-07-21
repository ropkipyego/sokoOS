import { create } from "zustand";

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
};

export type SaleRow = {
  id: string;
  receiptNo: string;
  branch: string;
  totalCents: number;
  tender: string;
  createdAt: string;
};

export type Branch = {
  id: string;
  name: string;
  code: string;
  city: string;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
};

type DemoDataState = {
  products: Product[];
  sales: SaleRow[];
  branches: Branch[];
  users: UserRow[];
  addProduct: (input: Omit<Product, "id">) => void;
};

const seedProducts: Product[] = [
  { id: "p1", sku: "RICE-5KG", name: "Premium Rice 5kg", category: "Staples", priceCents: 125000, stock: 42 },
  { id: "p2", sku: "COOK-OIL", name: "Cooking Oil 2L", category: "Staples", priceCents: 89000, stock: 18 },
  { id: "p3", sku: "SOAP-BAR", name: "Bar Soap Pack", category: "Household", priceCents: 15000, stock: 6 },
  { id: "p4", sku: "MILK-500", name: "Fresh Milk 500ml", category: "Dairy", priceCents: 8500, stock: 3 },
  { id: "p5", sku: "BREAD-WHT", name: "White Bread Loaf", category: "Bakery", priceCents: 7000, stock: 24 },
];

const seedSales: SaleRow[] = [
  { id: "s1", receiptNo: "R-1042", branch: "Nairobi CBD", totalCents: 214000, tender: "M-Pesa", createdAt: "2026-07-21T09:14:00Z" },
  { id: "s2", receiptNo: "R-1041", branch: "Westlands", totalCents: 89000, tender: "Cash", createdAt: "2026-07-21T08:51:00Z" },
  { id: "s3", receiptNo: "R-1040", branch: "Nairobi CBD", totalCents: 45500, tender: "Card", createdAt: "2026-07-20T17:22:00Z" },
];

export const useDemoDataStore = create<DemoDataState>((set) => ({
  products: seedProducts,
  sales: seedSales,
  branches: [
    { id: "b1", name: "Nairobi CBD", code: "NRB-01", city: "Nairobi" },
    { id: "b2", name: "Westlands", code: "NRB-02", city: "Nairobi" },
    { id: "b3", name: "Kisumu Central", code: "KSM-01", city: "Kisumu" },
  ],
  users: [
    { id: "u1", name: "Amina Otieno", email: "amina@sokoos.demo", role: "Owner", branch: "All" },
    { id: "u2", name: "James Mwangi", email: "james@sokoos.demo", role: "Manager", branch: "Nairobi CBD" },
    { id: "u3", name: "Faith Wanjiru", email: "faith@sokoos.demo", role: "Cashier", branch: "Westlands" },
  ],
  addProduct: (input) =>
    set((state) => ({
      products: [{ ...input, id: `p${Date.now()}` }, ...state.products],
    })),
}));

export function formatMoney(cents: number, currency = "KES"): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
