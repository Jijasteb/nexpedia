import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
}).strict();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    body = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return apiError("Data login tidak valid. Muat ulang halaman dan coba lagi.", 400, "INVALID_REQUEST");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Email/username atau password tidak valid.", 422, "VALIDATION_ERROR");

  try {
    const identifier = parsed.data.identifier.trim();
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
    });
    const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !valid || user.status !== "ACTIVE") {
      return apiError("Email/username atau password tidak valid.", 401, "INVALID_CREDENTIALS");
    }

    await createSession(user.id);
    return apiSuccess({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error("login_failed", error instanceof Error ? error.message : "unknown");
    return apiError("Login sementara tidak tersedia. Coba lagi beberapa saat.", 503, "LOGIN_UNAVAILABLE");
  }
}
