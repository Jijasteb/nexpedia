import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/security/crypto";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (token.length < 32 || token.length > 256) return NextResponse.redirect(new URL("/login?verification=invalid", request.url));
  const tokenHash = hashToken(token);
  const now = new Date();
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt <= now) return NextResponse.redirect(new URL("/login?verification=invalid", request.url));
  await db.$transaction(async (tx) => {
    const updated = await tx.emailVerificationToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (updated.count !== 1) throw new Error("VERIFICATION_TOKEN_ALREADY_USED");
    await tx.user.update({ where: { id: record.userId }, data: { status: "ACTIVE", emailVerifiedAt: now } });
    await tx.emailVerificationToken.updateMany({ where: { userId: record.userId, id: { not: record.id }, usedAt: null }, data: { usedAt: now } });
  }).catch(() => null);
  const fresh = await db.user.findUnique({ where: { id: record.userId }, select: { status: true } });
  if (fresh?.status !== "ACTIVE") return NextResponse.redirect(new URL("/login?verification=invalid", request.url));
  return NextResponse.redirect(new URL("/login?verification=success", request.url));
}
