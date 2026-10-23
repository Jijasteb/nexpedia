"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";

type Props = { userId: string; username: string; status: string };
export function UserStatusAction({ userId, username, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (status === "PENDING_VERIFICATION") return <span className="muted admin-user-action-note">Menunggu verifikasi</span>;
  const nextStatus = status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
  const suspending = nextStatus === "SUSPENDED";
  async function changeStatus() {
    const confirmText = suspending
      ? `Tangguhkan akun ${username}? Sesi login pengguna akan dicabut.`
      : `Aktifkan kembali akun ${username}?`;
    if (!window.confirm(confirmText)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false || result?.success === false) throw new Error(result?.error?.message ?? result?.message ?? "Status akun gagal diperbarui.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }
  return <div className="admin-user-status-action">
    <button type="button" className={`btn ${suspending ? "btn-quiet admin-suspend-btn" : "btn-primary"}`} onClick={changeStatus} disabled={busy}>
      {busy ? <LoaderCircle size={14} className="spin"/> : suspending ? <ShieldAlert size={14}/> : <ShieldCheck size={14}/>}
      {busy ? "Menyimpan…" : suspending ? "Tangguhkan" : "Aktifkan kembali"}
    </button>
    {error && <span className="admin-user-action-error" role="alert">{error}</span>}
  </div>;
}
