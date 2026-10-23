import { afterEach, describe, expect, it } from "vitest";
import { getAppName, getAppUrl, withMarkup } from "../src/lib/app-config";
const keys = ["APP_NAME", "APP_URL", "VERCEL_URL", "RAILWAY_PUBLIC_DOMAIN", "RENDER_EXTERNAL_URL", "NODE_ENV"] as const;
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
afterEach(() => { for (const key of keys) { const value = saved[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
describe("app configuration", () => {
  it("uses configured brand name", () => { process.env.APP_NAME = "Example Brand"; expect(getAppName()).toBe("Example Brand"); });
  it("detects Vercel origin when APP_URL is absent", () => { delete process.env.APP_URL; process.env.VERCEL_URL = "nexora-preview.vercel.app"; process.env.NODE_ENV = "production"; expect(getAppUrl()).toBe("https://nexora-preview.vercel.app"); });
  it("applies markup and rounds up to whole rupiah", () => { expect(withMarkup(100.1, 20)).toBe(121); expect(withMarkup(1000, 0)).toBe(1000); });
  it("rejects invalid amounts", () => { expect(() => withMarkup(-1, 10)).toThrow(); });
});
