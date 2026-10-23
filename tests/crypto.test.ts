import { describe, expect, it } from "vitest";
import { hashToken, randomToken, safeEqualHex } from "../src/lib/security/crypto";
describe("security helpers", () => {
  it("creates random tokens and hashes them deterministically", () => { const token = randomToken(); expect(token.length).toBeGreaterThan(20); expect(hashToken(token)).toBe(hashToken(token)); });
  it("compares equal hex strings safely and rejects malformed input", () => { expect(safeEqualHex("aabb", "aabb")).toBe(true); expect(safeEqualHex("aabb", "aabc")).toBe(false); expect(safeEqualHex("zz", "zz")).toBe(false); });
});
