import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
async function main() {
  const username = process.env.ADMIN_USERNAME?.trim() || "admin";
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) throw new Error("ADMIN_USERNAME must be 3-32 letters/numbers/underscores");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Set ADMIN_EMAIL to a valid email address in .env");
  if (password.length < 16 || password.length > 128 || (/replace-with|ganti-dengan|change-me|your-password|password-admin/i.test(password))) throw new Error("Set ADMIN_PASSWORD to a unique password of at least 16 characters in .env");
  const existing = await db.user.findUnique({ where: { username }, select: { id: true } });
  // Safety: every production build runs this script. Re-hashing and overwriting the admin's
  // password/email on each deploy would silently revert any credential the admin later rotates
  // in-app. Only the FIRST bootstrap sets the password from ADMIN_PASSWORD; afterwards this is a
  // no-op unless ADMIN_FORCE_RESET=true is explicitly set for a deliberate, one-time reset.
  const forceReset = process.env.ADMIN_FORCE_RESET?.trim().toLowerCase() === "true";
  if (existing && !forceReset) {
    // Idempotent no-op path: only re-affirm role/status, never touch password or email.
    const admin = await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "ACTIVE" }, select: { id: true, username: true, email: true, role: true } });
    await db.wallet.upsert({ where: { userId: admin.id }, create: { userId: admin.id, balance: 0n }, update: {} });
    console.log(`Admin already bootstrapped: ${admin.username}. Password/email left untouched (set ADMIN_FORCE_RESET=true to override).`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await db.user.upsert({
    where: { username },
    create: { username, email, passwordHash, role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date(), wallet: { create: { balance: 0n } } },
    update: { email, passwordHash, role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    select: { id: true, username: true, email: true, role: true },
  });
  await db.wallet.upsert({ where: { userId: admin.id }, create: { userId: admin.id, balance: 0n }, update: {} });
  console.log(`Admin bootstrapped: ${admin.username} (${admin.email}). Password is not printed.${forceReset ? " (forced reset)" : ""}`);
}
main().catch((error) => { console.error("Admin bootstrap failed:", error instanceof Error ? error.message : "unknown error"); process.exitCode = 1; }).finally(async () => db.$disconnect());
