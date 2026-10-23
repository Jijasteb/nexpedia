"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle } from "lucide-react";

type Props = { userId: string; username: string; balance: string };
function formatRupiah(value: string | number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
}

export function BalanceAdjustmentForm({ userId, username, balance }: Props) {
  const router = useRouter();
  const [direction, setDirection] = useState<"ADD" | "DEDUCT">("ADD");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount < 1 || numericAmount > 1_000_000_000_000) {
      setError(true); setMessage("Nominal harus berupa rupiah bulat yang valid."); return;
    }
    if (reason.trim().length < 8) { setError(true); setMessage("Tulis alasan minimal 8 karakter untuk audit."); return; }
    const verb = direction === "ADD" ? "MENAMBAH" : "MENGURANGI";
    if (!window.confirm(`${verb} saldo ${username} sebesar ${formatRupiah(numericAmount)}?\n\nSaldo saat ini: ${formatRupiah(balance)}\nAlasan: ${reason.trim()}`)) return;

    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/balance`, {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ direction, amount: numericAmount, reason: reason.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? "Penyesuaian saldo gagal.");
      const newBalance = payload?.data?.balanceAfter;
      setMessage(`Berhasil. Saldo baru: ${formatRupiah(newBalance ?? balance)}.`);
      setAmount(""); setReason("");
      router.refresh();
    } catch (caught) {
      setError(true); setMessage(caught instanceof Error ? caught.message : "Penyesuaian saldo gagal.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="balance-adjustment-form">
    <div className="balance-adjustment-controls">
      <label className="sr-only" htmlFor={`direction-${userId}`}>Jenis penyesuaian</label>
      <select id={`direction-${userId}`} value={direction} onChange={(event) => setDirection(event.target.value as "ADD" | "DEDUCT")} disabled={busy}>
        <option value="ADD">Tambah saldo</option><option value="DEDUCT">Kurangi saldo</option>
      </select>
      <label className="sr-only" htmlFor={`amount-${userId}`}>Nominal rupiah</label>
      <input id={`amount-${userId}`} type="number" inputMode="numeric" min="1" max="1000000000000" step="1" placeholder="Nominal (Rp)" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} required />
    </div>
    <label className="sr-only" htmlFor={`reason-${userId}`}>Alasan penyesuaian saldo</label>
    <input id={`reason-${userId}`} type="text" minLength={8} maxLength={500} placeholder="Alasan wajib untuk audit" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} required />
    <button type="submit" className={`btn ${direction === "ADD" ? "btn-primary" : "btn-quiet"} balance-adjustment-submit`} disabled={busy}>
      {busy ? <LoaderCircle size={14} className="spin-dot" /> : direction === "ADD" ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
      {busy ? "Memproses…" : direction === "ADD" ? "Tambah saldo" : "Kurangi saldo"}
    </button>
    {message && <p className={`balance-adjustment-message${error ? " is-error" : ""}`} role="status">{message}</p>}
  </form>;
}
