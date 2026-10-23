/** Amounts are integer IDR. Never use JS floating-point for persisted wallet balances. */
export function parseRupiahAmount(value: unknown, min = 2_000, max = 10_000_000): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error("INVALID_AMOUNT");
  return BigInt(value);
}
export function formatRupiah(amount: bigint | number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(amount));
}
