import Link from "next/link";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const rawUsername = process.env.TELEGRAM_ADMIN_USERNAME?.trim().replace(/^@/, "") ?? "";
  const telegramUsername = /^[a-zA-Z0-9_]{5,32}$/.test(rawUsername) ? rawUsername : "";
  const telegramUrl = telegramUsername ? `https://t.me/${telegramUsername}` : "";

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <Link href="/login" className="back-link"><ArrowLeft size={16} /> Kembali ke login</Link>
        <div className="auth-symbol"><MessageCircle size={25} /></div>
        <p className="eyebrow">BANTUAN AKUN</p>
        <h1 className="auth-title">Lupa password?</h1>
        <p className="muted auth-description">Hubungi admin resmi NEXORA melalui Telegram untuk bantuan pemulihan akun. Jangan pernah kirim password atau kode login Anda.</p>
        {telegramUrl ? (
          <a className="btn btn-primary auth-submit" href={telegramUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} /> Hubungi admin di Telegram
          </a>
        ) : (
          <div className="inline-alert" role="status">Kontak Telegram belum dikonfigurasi. Admin perlu mengisi TELEGRAM_ADMIN_USERNAME di Environment Variables.</div>
        )}
        <div className="security-note"><ShieldCheck size={17} /><span>Admin tidak akan meminta password Anda. Siapkan username dan email akun untuk membantu proses pengecekan.</span></div>
      </section>
    </main>
  );
}
