"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { readJsonResponse } from "@/lib/client-api";
export function AdminSyncButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function sync() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/providers/indosmm/sync", { method: "POST" });
      const body = await readJsonResponse<{ data: { imported: number; updated: number; skipped: number; total: number }; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(body?.error?.message ?? "Sinkronisasi gagal.");
      const data = body.data;
      setMessage(`Selesai: ${data.imported} baru, ${data.updated} diperbarui, ${data.skipped} dilewati dari ${data.total} layanan.`);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 10 }}><button type="button" className="btn btn-primary" onClick={sync} disabled={busy} style={{ width: "fit-content" }}><RefreshCw size={15}/>{busy ? "Menyinkronkan…" : "Sinkronkan katalog IndoSMM"}</button>{message && <p role="status" className="muted" style={{ fontSize: 12, margin: 0 }}>{message}</p>}</div>;
}
