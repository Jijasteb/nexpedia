import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { LedgerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, apiSuccess } from "@/lib/http";
import { postWalletEntry } from "@/lib/wallet/ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  direction: z.enum(["ADD", "DEDUCT"]),
  amount: z.number().int().safe().min(1).max(1_000_000_000_000),
  reason: z.string().trim().min(8).max(500),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return apiError(message === "FORBIDDEN" ? "Akses admin diperlukan." : "Silakan masuk terlebih dahulu.", message === "FORBIDDEN" ? 403 : 401, message === "FORBIDDEN" ? "FORBIDDEN" : "UNAUTHENTICATED");
  }

  // JSON-only same-origin mutation endpoint; do not accept browser form submissions.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return apiError("Permintaan lintas situs ditolak.", 403, "ORIGIN_MISMATCH");
    } catch {
      return apiError("Header Origin tidak valid.", 403, "INVALID_ORIGIN");
    }
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return apiError("Kunci idempotensi wajib diisi (8–128 karakter).", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Arah, nominal rupiah bulat, atau alasan penyesuaian tidak valid.", 422, "VALIDATION_ERROR");

  const { id: userId } = await context.params;
  const signedAmount = BigInt(parsed.data.amount) * (parsed.data.direction === "ADD" ? 1n : -1n);
  const reason = parsed.data.reason;
  const ledgerKey = `admin-adjust:${userId}:${idempotencyKey}`;
  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.walletLedger.findUnique({ where: { idempotencyKey: ledgerKey } });
      if (existing) {
        if (existing.userId !== userId || existing.amount !== signedAmount || existing.reason !== reason || existing.type !== LedgerType.ADJUSTMENT) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        return { replay: true, balanceBefore: existing.balanceBefore, balanceAfter: existing.balanceAfter, amount: existing.amount };
      }

      const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, username: true, wallet: { select: { id: true, balance: true } } } });
      if (!target) throw new Error("USER_NOT_FOUND");
      if (!target.wallet) throw new Error("WALLET_NOT_FOUND");

      const transaction = await tx.transaction.create({ data: {
        userId,
        type: LedgerType.ADJUSTMENT,
        amount: signedAmount,
        status: "POSTED",
        referenceId: `NXA-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`,
        description: `Penyesuaian saldo oleh admin ${admin.username}: ${reason}`,
      } });
      const entry = await postWalletEntry(tx, {
        userId,
        amount: signedAmount,
        type: LedgerType.ADJUSTMENT,
        transactionId: transaction.id,
        idempotencyKey: ledgerKey,
        referenceId: transaction.referenceId ?? transaction.id,
        reason,
      });
      await tx.auditLog.create({ data: {
        actorId: admin.id,
        action: parsed.data.direction === "ADD" ? "WALLET_BALANCE_ADDED" : "WALLET_BALANCE_DEDUCTED",
        targetType: "User",
        targetId: userId,
        metadata: {
          username: target.username,
          amount: signedAmount.toString(),
          balanceBefore: entry.balanceBefore.toString(),
          balanceAfter: entry.balanceAfter.toString(),
          reason,
          transactionId: transaction.id,
        },
      } });
      return { replay: false, balanceBefore: entry.balanceBefore, balanceAfter: entry.balanceAfter, amount: entry.amount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });

    return apiSuccess({
      message: result.replay ? "Penyesuaian sebelumnya sudah tercatat." : "Saldo berhasil disesuaikan.",
      replay: result.replay,
      amount: result.amount.toString(),
      balanceBefore: result.balanceBefore.toString(),
      balanceAfter: result.balanceAfter.toString(),
    }, result.replay ? 200 : 201);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") return apiError("Pengguna tidak ditemukan.", 404, "USER_NOT_FOUND");
    if (error instanceof Error && error.message === "WALLET_NOT_FOUND") return apiError("Wallet pengguna belum tersedia; saldo tidak diubah.", 409, "WALLET_NOT_FOUND");
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") return apiError("Saldo tidak cukup untuk dikurangi sebesar nominal tersebut.", 409, "INSUFFICIENT_BALANCE");
    if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT") return apiError("Kunci idempotensi sudah dipakai untuk penyesuaian berbeda.", 409, "IDEMPOTENCY_CONFLICT");
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return apiError("Terjadi konflik transaksi. Muat ulang saldo dan coba lagi dengan permintaan baru.", 409, "TRANSACTION_CONFLICT");
    console.error("admin_wallet_adjustment_failed", error instanceof Error ? error.message : "unknown");
    return apiError("Saldo tidak berubah karena penyesuaian gagal. Periksa koneksi database dan coba kembali.", 503, "ADJUSTMENT_FAILED");
  }
}
