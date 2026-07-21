import type { ProductRecord } from "./types";

/** Sample catalog so the POS works without an API. */
export const SEED_PRODUCTS: ProductRecord[] = [
  { id: "prod_rice", sku: "RICE-5KG", name: "Premium Rice 5kg", category: "Staples", priceCents: 125000, stock: 40 },
  { id: "prod_oil", sku: "COOK-OIL", name: "Cooking Oil 2L", category: "Staples", priceCents: 89000, stock: 28 },
  { id: "prod_sugar", sku: "SUGAR-2KG", name: "Sugar 2kg", category: "Staples", priceCents: 42000, stock: 35 },
  { id: "prod_soap", sku: "SOAP-BAR", name: "Bar Soap Pack", category: "Household", priceCents: 15000, stock: 50 },
  { id: "prod_detergent", sku: "DET-1KG", name: "Detergent 1kg", category: "Household", priceCents: 28000, stock: 22 },
  { id: "prod_milk", sku: "MILK-500", name: "Fresh Milk 500ml", category: "Dairy", priceCents: 8500, stock: 18 },
  { id: "prod_yogurt", sku: "YOG-250", name: "Yogurt Cup 250ml", category: "Dairy", priceCents: 12000, stock: 14 },
  { id: "prod_bread", sku: "BREAD-WHT", name: "White Bread Loaf", category: "Bakery", priceCents: 7000, stock: 30 },
  { id: "prod_soda", sku: "SODA-500", name: "Soda 500ml", category: "Beverages", priceCents: 6000, stock: 60 },
  { id: "prod_water", sku: "WATER-1L", name: "Drinking Water 1L", category: "Beverages", priceCents: 4000, stock: 80 },
  { id: "prod_tea", sku: "TEA-500", name: "Tea Leaves 500g", category: "Beverages", priceCents: 22000, stock: 16 },
  { id: "prod_eggs", sku: "EGGS-30", name: "Eggs Tray (30)", category: "Dairy", priceCents: 55000, stock: 12 },
];

export const SEED_CATEGORIES = ["All", "Staples", "Household", "Dairy", "Bakery", "Beverages"] as const;
