/** Server-side application configuration with safe platform URL detection. */
export function getAppName(): string {
  return (process.env.APP_NAME?.trim() || "NEXORA SMM Panel").slice(0, 80);
}

export function getAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  const vercel = process.env.VERCEL_URL?.trim();
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  const candidate = configured || (vercel ? `https://${vercel}` : railway ? `https://${railway}` : render || "http://localhost:3000");
  const url = new URL(candidate);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_URL_MUST_USE_HTTPS_IN_PRODUCTION");
  return url.origin;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const expected = process.env.APP_URL?.trim() ? getAppUrl() : new URL(request.url).origin;
    return new URL(origin).origin === expected;
  } catch { return false; }
}

function percentEnv(name: string, fallback = 0): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 500) throw new Error(`${name}_MUST_BE_BETWEEN_0_AND_500`);
  return value;
}

export const getOrderMarkupPercent = () => percentEnv("ORDER_MARKUP_PERCENT", 0);
export const getDepositMarkupPercent = () => percentEnv("DEPOSIT_MARKUP_PERCENT", 0);
export function withMarkup(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("INVALID_AMOUNT");
  return Math.ceil(amount * (1 + percent / 100));
}
