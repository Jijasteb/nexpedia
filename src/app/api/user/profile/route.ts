import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/http";
export async function GET() {
  const sessionUser = await getSessionUser(); if (!sessionUser) return apiError("Silakan login", 401, "UNAUTHENTICATED");
  const user = await db.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, username: true, email: true, role: true, status: true, createdAt: true, wallet: { select: { balance: true, currency: true } } } });
  return apiSuccess(user);
}
