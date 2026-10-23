"use client";
import { useState } from "react";
import { LoaderCircle, WalletCards } from "lucide-react";
import { readJsonResponse } from "@/lib/client-api";

type Result = { data?: { deposit?: { reference: string; amount: string; feeAmount?: string; gatewayAmount?: string; status: string; checkoutUrl?: string | null; qrUrl?: string | null; expiresAt?: string | null } }; error?: { message?: string; code?: string } };
export default function DepositForm() {
  const [amount, setAmount] = useState("50000");
  const [method, setMethod] = useState("QRIS");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result["data"] extends infer T ? T : never>(undefined);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setResult(undefined);
    const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `dep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const response = await fetch("/api/deposits", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ amount: Number(amount), paymentMethod: method }) });
      const body = await readJsonResponse<Result>(response);
      if (!response.ok && response.status !== 202) throw new Error(body.error?.message || "Deposit gagal dibuat.");
      if (body.data?.deposit) setResult(body.data);
      else setMessage(body.error?.message || "Permintaan tersimpan untuk pemeriksaan. Cek riwayat deposit sebelum mencoba lagi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }
  return <section className="panel" style={{ padding: 24, maxWidth: 600 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}><WalletCards size={21} color="var(--primary)"/><div><h2 style={{ margin: 0, fontSize: 19 }}>Tambah saldo</h2><p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>Nominal Rp10.000 sampai Rp10.000.000.</p></div></div>
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 650 }}>Nominal deposit (IDR)<input className="input" inputMode="numeric" type="number" min="10000" max="10000000" step="1000" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 650 }}>Metode pembayaran<select className="input" value={method} onChange={e => setMethod(e.target.value)}><option value="QRIS">QRIS</option><option value="VA">Virtual Account</option><option value="EWALLET">E-Wallet (jika tersedia)</option></select></label>
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? <><LoaderCircle size={15} className="spin"/> Membuat permintaan…</> : "Buat deposit"}</button>
    </form>
    {message && <p role="status" style={{ marginTop: 16, color: "#9a3412", fontSize: 13 }}>{message}</p>}
    {result?.deposit && <div role="status" className="panel" style={{ padding: 16, marginTop: 18, background: "var(--surface-muted, #f8f8fb)" }}><strong>Referensi: {result.deposit.reference}</strong><p style={{ marginBlock: 8, fontSize: 13 }}>Saldo yang ditambahkan: Rp{Number(result.deposit.amount).toLocaleString("id-ID")} · Biaya: Rp{Number(result.deposit.feeAmount ?? "0").toLocaleString("id-ID")} · Total bayar: Rp{Number(result.deposit.gatewayAmount ?? result.deposit.amount).toLocaleString("id-ID")} · Status: {result.deposit.status}</p>{result.deposit.checkoutUrl && <a className="btn btn-primary" href={result.deposit.checkoutUrl} target="_blank" rel="noreferrer">Lanjutkan pembayaran</a>}{result.deposit.qrUrl && <p><a href={result.deposit.qrUrl} target="_blank" rel="noreferrer">Buka QR pembayaran</a></p>}<p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Saldo hanya bertambah setelah pembayaran terverifikasi oleh webhook yang valid.</p></div>}
  </section>;
}
