import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
  acceptedTerms: z.literal(true),
}).strict()
  .refine((value) => ["gmail.com", "googlemail.com"].includes(value.email.split("@")[1] ?? ""), {
    path: ["email"],
    message: "Gunakan alamat Gmail yang valid.",
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Password tidak cocok",
  });

type KickboxResult = { result?: string; reason?: string; disposable?: boolean; did_you_mean?: string | null };

async function validateEmailWithKickbox(email: string): Promise<KickboxResult> {
  const apiKey = process.env.KICKBOX_API_KEY?.trim();
  if (!apiKey) throw new Error("KICKBOX_NOT_CONFIGURED");
  const url = new URL("https://api.kickbox.com/v2/verify");
  url.searchParams.set("email", email);
  url.searchParams.set("apikey", apiKey);
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`KICKBOX_HTTP_${response.status}`);
  const result = await response.json() as KickboxResult;
  if (!result || typeof result.result !== "string") throw new Error("KICKBOX_INVALID_RESPONSE");
  return result;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const form = await request.formData();
      const values: Record<string, unknown> = Object.fromEntries(form.entries());
      if ("acceptedTerms" in values) values.acceptedTerms = true;
      body = values;
    }
  } catch {
    return apiError("Data pendaftaran tidak valid. Muat ulang halaman dan coba lagi.", 400, "INVALID_REQUEST");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("Gunakan Gmail, periksa username dan persetujuan, serta buat password minimal 12 karakter.", 422, "VALIDATION_ERROR");
  }

  const { username, email, password } = parsed.data;

  try {
    const emailCheck = await validateEmailWithKickbox(email);
    if (emailCheck.result !== "deliverable" || emailCheck.disposable === true) {
      const hint = emailCheck.did_you_mean ? ` Mungkin maksud Anda ${emailCheck.did_you_mean}.` : "";
      return apiError(`Email tidak dapat diverifikasi sebagai alamat yang bisa menerima email.${hint}`, 422, "EMAIL_NOT_DELIVERABLE");
    }
  } catch (error) {
    console.error("kickbox_validation_failed", error instanceof Error ? error.message : "unknown");
    return apiError(
      error instanceof Error && error.message === "KICKBOX_NOT_CONFIGURED"
        ? "Validasi email belum dikonfigurasi. Tambahkan KICKBOX_API_KEY di Environment Variables."
        : "Layanan validasi email sedang tidak tersedia. Coba lagi beberapa saat.",
      503,
      "EMAIL_VALIDATION_UNAVAILABLE",
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.create({
      data: {
        username,
        email,
        passwordHash,
        status: "ACTIVE",
        // Kickbox checks deliverability, not mailbox ownership. Ownership verification
        // requires a separate confirmation email and is intentionally not implied here.
        emailVerifiedAt: null,
        wallet: { create: { balance: 0n } },
      },
    });
    return apiSuccess({ message: "Akun berhasil dibuat. Silakan masuk." }, 201);
  } catch (error) {
    const prismaCode = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
    if (prismaCode === "P2002") {
      return apiError("Username atau email sudah digunakan.", 409, "ACCOUNT_EXISTS");
    }
    console.error("registration_failed", prismaCode || (error instanceof Error ? error.message : "unknown"));
    if (["P2021", "P2022"].includes(prismaCode)) {
      return apiError("Struktur tabel Neon belum sesuai. Deploy ulang setelah proses sinkronisasi skema database berhasil.", 503, "DATABASE_SCHEMA_NOT_READY");
    }
    if (["P1001", "P1002", "P1008", "P1017"].includes(prismaCode)) {
      return apiError("Database Neon tidak dapat dijangkau. Periksa DATABASE_URL dan status database.", 503, "DATABASE_UNAVAILABLE");
    }
    return apiError("Pendaftaran belum dapat diselesaikan. Periksa DATABASE_URL, skema Neon, dan KICKBOX_API_KEY.", 503, "REGISTRATION_FAILED");
  }
}
