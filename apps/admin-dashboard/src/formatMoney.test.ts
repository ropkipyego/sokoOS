import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMoney } from "./stores/demoData.ts";

test("formatMoney renders KES with cents", () => {
  assert.equal(formatMoney(125000), "KES 1,250.00");
});
