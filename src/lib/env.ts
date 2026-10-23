import { z } from "zod";
const percentage = z.string().optional().default("0").refine((v) => { const n = Number(v); return v.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 500; }, "Must be between 0 and 500");
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ADMIN_USERNAME: z.string().optional().default("admin"),
  ADMIN_PASSWORD: z.string().optional().default(""),
  ADMIN_EMAIL: z.email().optional().default(""),
  APP_NAME: z.string().trim().min(1).max(80).optional().default("NEXORA SMM Panel"),
  ORDER_MARKUP_PERCENT: percentage,
  DEPOSIT_MARKUP_PERCENT: percentage,
  CASHI_API_KEY: z.string().optional().default(""),
  CASHI_WEBHOOK_SECRET: z.string().optional().default(""),
  CASHI_BASE_URL: z.string().url().optional().default("https://cashi.id/api"),
  SMM_API_KEY: z.string().optional().default(""),
  SMM_BASE_URL: z.string().url().optional().default("https://indosmm.id/api/v2"),
  KICKBOX_API_KEY: z.string().optional().default(""),
  TELEGRAM_ADMIN_USERNAME: z.string().optional().default(""),
});
export function getEnv() { return envSchema.parse(process.env); }
