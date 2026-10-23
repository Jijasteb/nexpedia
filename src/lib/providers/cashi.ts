import { z } from "zod";
const BASE_URL = (process.env.CASHI_BASE_URL || "https://cashi.id/api").replace(/\/$/, "");
const CreateSchema = z.object({ order_id: z.string().optional(), status: z.string().optional(), checkout_url: z.string().url().refine((v) => v.startsWith("https://"), "HTTPS required").optional(), qrUrl: z.string().url().refine((v) => v.startsWith("https://"), "HTTPS required").optional(), payment_method: z.string().optional(), expires_at: z.string().optional() }).passthrough();

/** CASHI adapter. Webhook signature/payload mapping must be confirmed against the gateway's current official contract. */
export const cashi = {
  async createOrder(input: { amount: number; order_id: string }) {
    const key = process.env.CASHI_API_KEY;
    if (!key) throw new Error("CASHI_NOT_CONFIGURED");
    const response = await fetch(`${BASE_URL}/create-order`, { method: "POST", headers: { "content-type": "application/json", "x-api-key": key }, body: JSON.stringify(input), signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) throw new Error(`CASHI_HTTP_${response.status}`);
    return CreateSchema.parse(await response.json());
  },
  async checkStatus(orderId: string) {
    const key = process.env.CASHI_API_KEY;
    if (!key) throw new Error("CASHI_NOT_CONFIGURED");
    const response = await fetch(`${BASE_URL}/check-status/${encodeURIComponent(orderId)}`, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) throw new Error(`CASHI_HTTP_${response.status}`);
    return z.record(z.string(), z.unknown()).parse(await response.json());
  },
};
