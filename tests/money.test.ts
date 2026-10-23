import { describe, expect, it } from "vitest";
import { parseRupiahAmount } from "../src/lib/wallet/money";
describe("parseRupiahAmount", () => {
  it("accepts valid integer IDR", () => expect(parseRupiahAmount(50_000)).toBe(50_000n));
  it("rejects fractional amount", () => expect(() => parseRupiahAmount(2000.5)).toThrow("INVALID_AMOUNT"));
  it("rejects out-of-range amount", () => expect(() => parseRupiahAmount(1000)).toThrow("INVALID_AMOUNT"));
  it("rejects unsafe integers", () => expect(() => parseRupiahAmount(Number.MAX_SAFE_INTEGER + 1)).toThrow("INVALID_AMOUNT"));
});
