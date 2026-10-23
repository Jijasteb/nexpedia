"use client";
import { useState } from "react";
import { readJsonResponse } from "@/lib/client-api";
type Item = { id: string; name: string; baseRate: string; sellingRate: string; isActive: boolean; providerEnabled: boolean };
export function ServiceEditor({ item }: { item: Item }) {
  const [active, setActive] = useState(item.isActive);
  const [rate, setRate] = useState(item.sellingRate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/services/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: active, sellingRate: rate }) });
      const body = await readJsonResponse<{ data: { isActive: boolean; sellingRate: string }; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(body?.error?.message ?? "Perubahan gagal.");
      setActive(body.data.isActive); setRate(body.data.sellingRate); setMessage("Tersimpan");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!item.providerEnabled}/> Aktif</label><label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>Rp <input aria-label={`Harga jual ${item.name}`} className="field" style={{ width: 130, minHeight: 36, padding: 7 }} value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal"/></label><button type="button" className="btn btn-quiet" onClick={save} disabled={busy}>{busy ? "…" : "Simpan"}</button>{message && <span role="status" className="muted" style={{ fontSize: 11 }}>{message}</span>}</div>;
}
