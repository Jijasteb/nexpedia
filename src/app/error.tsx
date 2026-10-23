"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("nexora_app_error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="auth-shell">
      <section className="auth-card panel" role="alert">
        <div className="auth-symbol"><AlertTriangle size={24} /></div>
        <p className="eyebrow">TERJADI GANGGUAN</p>
        <h1 className="auth-title">Halaman belum bisa dimuat.</h1>
        <p className="auth-description muted">Coba muat ulang halaman. Jika masalah berlanjut, periksa koneksi database dan konfigurasi layanan.</p>
        <div className="error-actions">
          <button type="button" className="btn btn-primary" onClick={() => reset()}><RefreshCw size={16} /> Coba lagi</button>
          <Link className="btn btn-quiet" href="/">Kembali ke beranda</Link>
        </div>
      </section>
    </main>
  );
}
