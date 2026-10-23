"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

type ApiResponse = { data?: { user?: { role?: string }; message?: string }; error?: { message?: string } };

async function readResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text();
  if (!text.trim()) {
    return { error: { message: response.ok
      ? "Server tidak mengirim respons. Coba muat ulang halaman."
      : `Permintaan gagal (HTTP ${response.status}). Coba lagi beberapa saat.` } };
  }
  try {
    const parsed = JSON.parse(text) as ApiResponse;
    if (!parsed || typeof parsed !== "object") throw new Error("invalid_response");
    return parsed;
  } catch {
    return { error: { message: response.ok
      ? "Respons server tidak valid. Coba muat ulang halaman."
      : `Server sedang bermasalah (HTTP ${response.status}). Coba lagi beberapa saat.` } };
  }
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ identifier: form.get("identifier"), password: form.get("password") }),
      });
      const body = await readResponse(response);
      if (!response.ok || !body?.data?.user?.role) throw new Error(body?.error?.message || "Login belum dapat diproses. Periksa data akun dan coba lagi.");
      const role = body.data.user.role;
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/admin") ? next : "";
      router.replace(role === "ADMIN" ? "/admin" : safeNext || "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <Link href="/" className="brand-lockup"><Image src="/nexora-mark.svg" width={40} height={40} alt="" priority /><span>NEXORA</span></Link>
        <p className="eyebrow" style={{ marginTop: 30 }}>WORKSPACE LOGIN</p>
        <h1 className="auth-title">Senang melihatmu kembali.</h1>
        <p className="auth-description muted">Masuk untuk melanjutkan pengelolaan layanan, pesanan, dan saldo Anda.</p>
        {params.get("verification") === "success" && <p role="status" className="inline-success">Email berhasil diverifikasi. Silakan masuk.</p>}
        {params.get("verification") === "invalid" && <p role="alert" className="inline-alert">Tautan verifikasi tidak valid atau sudah kedaluwarsa.</p>}
        {error && <p role="alert" className="inline-alert" style={{ marginBottom: 16 }}>{error}</p>}
        <form onSubmit={submit} noValidate>
          <div className="form-field">
            <label htmlFor="identifier">Email atau username</label>
            <input id="identifier" name="identifier" autoComplete="username" required maxLength={254} placeholder="nama atau email@gmail.com" className="input" aria-describedby="identifier-hint" />
            <small id="identifier-hint" className="muted">Gunakan username atau email yang terdaftar.</small>
          </div>
          <div className="form-field">
            <div className="label-row"><label htmlFor="password">Password</label><Link href="/forgot-password">Lupa password?</Link></div>
            <div className="password-wrap"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} placeholder="Masukkan password" className="input" /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>{busy ? <><span className="spin-dot"/> Memeriksa akun…</> : <>Masuk ke workspace <ArrowRight size={17}/></>}</button>
        </form>
        <p className="auth-footnote">Belum punya akun? <Link href="/register">Buat akun baru</Link></p>
        <div className="auth-security"><LockKeyhole size={15}/><span>Koneksi akun dilindungi dengan sesi aman.</span></div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="auth-shell"><section className="auth-card panel">Memuat halaman masuk…</section></main>}><LoginForm/></Suspense>;
}
