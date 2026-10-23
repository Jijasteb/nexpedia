"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

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

export default function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    setError("");
    setSuccess("");
    if (password.length < 12) { setError("Password minimal 12 karakter."); return; }
    if (password !== confirmPassword) { setError("Konfirmasi password tidak cocok."); return; }
    if (form.get("acceptedTerms") !== "on") { setError("Setujui ketentuan untuk membuat akun."); return; }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          email: form.get("email"),
          password,
          confirmPassword,
          acceptedTerms: true,
        }),
      });
      const body = await readResponse(response);
      if (!response.ok || !body?.data?.message) throw new Error(body?.error?.message || "Pendaftaran belum dapat diproses. Periksa konfigurasi database dan Kickbox, lalu coba lagi.");
      setSuccess(body.data.message);
      formElement.reset();
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
        <p className="eyebrow" style={{ marginTop: 30 }}>CREATE YOUR WORKSPACE</p>
        <h1 className="auth-title">Mulai dengan akun baru.</h1>
        <p className="auth-description muted">Satu akun untuk mengelola layanan dan memantau aktivitas Anda.</p>
        {error && <p role="alert" className="inline-alert" style={{ marginBottom: 16 }}>{error}</p>}
        {success && <div role="status" className="inline-success" style={{ marginBottom: 16 }}>{success} <Link href="/login">Masuk ke akun</Link></div>}
        <form onSubmit={submit} noValidate>
          <div className="form-field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" className="input" placeholder="contoh: nexora_user" aria-describedby="username-hint"/><small id="username-hint" className="muted">3–32 karakter, huruf, angka, dan underscore.</small></div>
          <div className="form-field"><label htmlFor="email">Alamat email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" placeholder="nama@gmail.com"/><small className="muted">Email akan dicek kelayakannya oleh Kickbox sebelum akun dibuat.</small></div>
          <div className="form-field"><label htmlFor="password">Password</label><div className="password-wrap"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} className="input" placeholder="Minimal 12 karakter"/><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
          <div className="form-field"><label htmlFor="confirmPassword">Konfirmasi password</label><div className="password-wrap"><input id="confirmPassword" name="confirmPassword" type={showConfirm ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} className="input" placeholder="Ulangi password"/><button type="button" className="password-toggle" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}>{showConfirm ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
          <label className="terms-check"><input type="checkbox" name="acceptedTerms" required/><span>Saya menyetujui <Link href="/terms" target="_blank">Ketentuan</Link> dan <Link href="/privacy" target="_blank">Kebijakan Privasi</Link>.</span></label>
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>{busy ? <><span className="spin-dot"/> Memeriksa email…</> : <>Buat akun <ArrowRight size={17}/></>}</button>
        </form>
        <p className="auth-footnote">Sudah punya akun? <Link href="/login">Masuk</Link></p>
        <div className="auth-security"><ShieldCheck size={15}/><span>Kickbox memeriksa kelayakan alamat email, bukan membuktikan kepemilikan inbox.</span></div>
      </section>
    </main>
  );
}
