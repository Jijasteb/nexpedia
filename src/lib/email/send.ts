import { z } from "zod";
import { getAppUrl } from "@/lib/app-config";

const ResponseSchema = z.object({ id: z.string().optional() }).passthrough();

/** Send transactional mail via Resend. No API key means fail closed, never silently pretend delivery. */
export async function sendTransactionalEmail(input: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_HTTP_${response.status}`);
  return ResponseSchema.parse(await response.json().catch(() => ({})));
}

export function safeAppUrl(path: string) {
  return new URL(path, getAppUrl()).toString();
}
