import { createHash, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { safeEqualHex } from "@/lib/security/crypto";

/**
 * Deliberately fail-closed until CASHI's exact signed bytes, header encoding,
 * payload schema, and paid-status contract have been verified from official docs.
 * Do not credit wallets from an assumed payload shape.
 */
export async function POST(request: NextRequest) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 64 * 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const secret = process.env.CASHI_WEBHOOK_SECRET;
  const signature = request.headers.get("x-gateway-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook verification unavailable" }, { status: 503 });
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (!safeEqualHex(signature, expected)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // Signature is valid, but settlement remains disabled until provider payload/status mapping is verified.
  const payloadHash = createHash("sha256").update(raw).digest("hex");
  return NextResponse.json({ received: true, verified: true, settlement: "disabled_pending_contract_verification", payloadHash }, { status: 202 });
}
