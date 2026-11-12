import type { LocalDb } from "../db";
import type { SyncWorker } from "../sync";
import { useCartStore } from "../stores/cart";
import { useSession } from "../stores/session";

/**
 * Completing a sale MUST:
 * 1. Write local sale + stock movement + outbox
 * 2. Attempt background sync
 * Never block the cashier on network.
 */
export async function completeSaleOffline(db: LocalDb, sync: SyncWorker): Promise<void> {
  const { lines, tender, cashTenderedCents, clear, setLastSale, triggerPaySuccess } =
    useCartStore.getState();
  const session = useSession.getState();
  if (lines.length === 0) return;
  if (!session.branchId) {
    throw new Error("Branch is required for offline sale");
  }

  const sale = await db.completeSale({
    branchId: session.branchId,
    warehouseId: session.warehouseId ?? undefined,
    departmentId: session.departmentId ?? undefined,
    customerId: undefined,
    currency: session.currency,
    cashTenderedCents: tender === "cash" ? cashTenderedCents : undefined,
    tender,
    lines: lines.map((line) => ({ productId: line.productId, qty: line.qty })),
  });

  clear();
  setLastSale(sale);
  triggerPaySuccess();

  // Fire-and-forget sync — sale already committed locally.
  sync.enqueueFlush();
}
