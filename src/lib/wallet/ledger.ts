import { Prisma, LedgerType, LedgerStatus } from "@prisma/client";
import { db } from "@/lib/db";

/** Call only inside an existing Prisma transaction. A conditional update prevents overspending under concurrency. */
export async function postWalletEntry(tx: Prisma.TransactionClient, input: {
  userId: string; amount: bigint; type: LedgerType; transactionId: string;
  idempotencyKey: string; referenceId?: string; reason?: string; allowNegative?: boolean;
}) {
  const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
  if (!wallet) throw new Error("WALLET_NOT_FOUND");
  const before = wallet.balance;
  const after = before + input.amount;
  if (!input.allowNegative && after < 0n) throw new Error("INSUFFICIENT_BALANCE");
  const changed = await tx.wallet.updateMany({ where: { id: wallet.id, balance: before }, data: { balance: after } });
  if (changed.count !== 1) throw new Error("WALLET_CONCURRENT_MODIFICATION");
  return tx.walletLedger.create({ data: {
    userId: input.userId, walletId: wallet.id, transactionId: input.transactionId,
    type: input.type, amount: input.amount, balanceBefore: before, balanceAfter: after,
    idempotencyKey: input.idempotencyKey, referenceId: input.referenceId,
    reason: input.reason, status: LedgerStatus.POSTED,
  } });
}
export async function withWalletTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
}
