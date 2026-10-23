import { z } from "zod";

const BASE_URL = (process.env.SMM_BASE_URL || "https://indosmm.id/api/v2").replace(/\/$/, "");
const ServiceSchema = z.object({ service: z.union([z.string(), z.number()]), name: z.string(), type: z.string().optional(), category: z.string().optional(), rate: z.union([z.string(), z.number()]), min: z.union([z.string(), z.number()]), max: z.union([z.string(), z.number()]), refill: z.union([z.boolean(), z.string()]).optional(), cancel: z.union([z.boolean(), z.string()]).optional() }).passthrough();
export type IndoService = z.infer<typeof ServiceSchema>;

async function post<T>(params: Record<string, string | number>, schema: z.ZodType<T>): Promise<T> {
  const key = process.env.SMM_API_KEY;
  if (!key) throw new Error("INDOSMM_NOT_CONFIGURED");
  const body = new URLSearchParams({ key, ...Object.fromEntries(Object.entries(params).map(([k,v]) => [k, String(v)])) });
  const response = await fetch(BASE_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!response.ok) throw new Error(`INDOSMM_HTTP_${response.status}`);
  const json: unknown = await response.json();
  return schema.parse(json);
}
const ServicesSchema = z.array(ServiceSchema);
const BalanceSchema = z.object({ balance: z.union([z.string(), z.number()]), currency: z.string().optional() }).passthrough();
const AddOrderSchema = z.object({ order: z.union([z.string(), z.number()]) }).passthrough();
const StatusSchema = z.object({ status: z.string() }).passthrough();
const RefillSchema = z.object({ refill: z.union([z.string(), z.number()]).optional(), error: z.string().optional() }).passthrough();

/** Server-only adapter. Keep provider-specific parsing isolated; verify actual provider responses before production. */
export const indosmm = {
  getServices: () => post({ action: "services" }, ServicesSchema),
  getBalance: () => post({ action: "balance" }, BalanceSchema),
  createOrder: (input: { service: string; link: string; quantity: number }) => post({ action: "add", ...input }, AddOrderSchema),
  getOrderStatus: (order: string) => post({ action: "status", order }, StatusSchema),
  getMultipleOrderStatuses: async (orders: string[]) => {
    if (orders.length < 1 || orders.length > 100) throw new Error("INVALID_ORDER_BATCH_SIZE");
    const key = process.env.SMM_API_KEY;
    if (!key) throw new Error("INDOSMM_NOT_CONFIGURED");
    const response = await fetch(BASE_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key, action: "status", orders: orders.join(",") }), signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) throw new Error(`INDOSMM_HTTP_${response.status}`);
    return z.record(z.string(), z.unknown()).parse(await response.json());
  },
  createRefill: (order: string) => post({ action: "refill", order }, RefillSchema),
  getRefillStatus: (refill: string) => post({ action: "refill_status", refill }, z.unknown()),
  cancelOrder: (order: string) => post({ action: "cancel", orders: order }, z.unknown()),
};
