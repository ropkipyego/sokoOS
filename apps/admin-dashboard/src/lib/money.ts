export function formatMoney(minor: number, currency = "KES"): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseMoneyToMinor(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
