import { NextResponse } from "next/server";

export async function POST() {
  const rawUsername = process.env.TELEGRAM_ADMIN_USERNAME?.trim().replace(/^@/, "") ?? "";
  const username = /^[a-zA-Z0-9_]{5,32}$/.test(rawUsername) ? rawUsername : "";
  if (!username) {
    return NextResponse.json({ error: { code: "TELEGRAM_NOT_CONFIGURED", message: "Kontak Telegram admin belum dikonfigurasi." } }, { status: 503 });
  }
  return NextResponse.json({ data: { message: "Hubungi admin melalui Telegram untuk bantuan pemulihan akun.", telegramUrl: `https://t.me/${username}` } });
}
