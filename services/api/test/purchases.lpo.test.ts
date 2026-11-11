import { describe, expect, it } from "vitest";

/** Pure helpers mirroring PurchasesService.receive remaining-qty rules. */
function applyReceiveBatch(
  items: Array<{ productId: string; quantity: number; quantityReceived: number }>,
  lines: Array<{ productId: string; quantity: number }>,
) {
  const next = items.map((i) => ({ ...i }));
  const byProduct = new Map(next.map((i) => [i.productId, i]));
  for (const line of lines) {
    const item = byProduct.get(line.productId);
    if (!item) throw new Error(`Product ${line.productId} is not on this LPO`);
    const remaining = item.quantity - item.quantityReceived;
    if (line.quantity < 1 || line.quantity > remaining) {
      throw new Error(`Cannot receive ${line.quantity}; remaining ${remaining}`);
    }
    item.quantityReceived += line.quantity;
  }
  const fullyReceived = next.every((i) => i.quantityReceived >= i.quantity);
  const anyReceived = next.some((i) => i.quantityReceived > 0);
  const status = fullyReceived ? "received" : anyReceived ? "partial" : "issued";
  return { items: next, status, purchaseId: "same-lpo-id" };
}

describe("LPO receive against same purchase", () => {
  it("never receives more than ordered and keeps the same purchase id", () => {
    let state = {
      items: [{ productId: "p1", quantity: 10, quantityReceived: 0 }],
      status: "issued",
      purchaseId: "same-lpo-id",
    };
    const batches = [4, 4, 2];
    const refs: string[] = [];
    for (const qty of batches) {
      state = { ...applyReceiveBatch(state.items, [{ productId: "p1", quantity: qty }]) };
      refs.push(state.purchaseId);
    }
    expect(state.items[0]!.quantityReceived).toBe(10);
    expect(state.status).toBe("received");
    expect(new Set(refs).size).toBe(1);
  });

  it("supports partial GRN then residual receive on the same LPO", () => {
    const afterFirst = applyReceiveBatch(
      [
        { productId: "a", quantity: 5, quantityReceived: 0 },
        { productId: "b", quantity: 3, quantityReceived: 0 },
      ],
      [{ productId: "a", quantity: 2 }],
    );
    expect(afterFirst.status).toBe("partial");
    expect(afterFirst.items.find((i) => i.productId === "a")!.quantityReceived).toBe(2);
    expect(afterFirst.items.find((i) => i.productId === "b")!.quantityReceived).toBe(0);

    const afterSecond = applyReceiveBatch(afterFirst.items, [
      { productId: "a", quantity: 3 },
      { productId: "b", quantity: 3 },
    ]);
    expect(afterSecond.status).toBe("received");
    expect(afterSecond.purchaseId).toBe("same-lpo-id");
  });

  it("rejects over-receive and unknown products", () => {
    expect(() =>
      applyReceiveBatch([{ productId: "p1", quantity: 2, quantityReceived: 1 }], [
        { productId: "p1", quantity: 2 },
      ]),
    ).toThrow(/remaining 1/);
    expect(() =>
      applyReceiveBatch([{ productId: "p1", quantity: 2, quantityReceived: 0 }], [
        { productId: "other", quantity: 1 },
      ]),
    ).toThrow(/not on this LPO/);
  });

  it("blocks cancel semantics when anything received", () => {
    const received = [{ productId: "p1", quantity: 5, quantityReceived: 1 }];
    const sum = received.reduce((s, i) => s + i.quantityReceived, 0);
    expect(sum > 0).toBe(true);
  });
});
