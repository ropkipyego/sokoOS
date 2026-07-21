import type { LocalDb } from "../db";
import type { SyncWorker } from "../sync";
import { useCartStore } from "../stores/cart";

/**
 * Completing a sale MUST:
 * 1. Write local sale + stock movement + outbox
 * 2. Attempt background sync
 * Never block the cashier on network.
 */
export async function completeSaleOffline(db: LocalDb, sync: SyncWorker): Promise<void> {
  const { lines, tender, clear, setLastSale, triggerPaySuccess } = useCartStore.getState();
  if (lines.length === 0) return;

  const sale = await db.completeSale({
    branchId: "branch_nairobi_cbd",
    tender,
    lines: lines.map((line) => ({ productId: line.productId, qty: line.qty })),
  });

  clear();
  setLastSale(sale);
  triggerPaySuccess();

  // Fire-and-forget sync — sale already committed locally.
  sync.enqueueFlush();
}
