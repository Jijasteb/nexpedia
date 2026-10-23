"use client";
import { useState } from "react";
import { readJsonResponse } from "@/lib/client-api";
export function ProviderToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function toggle() {
    if (!window.confirm(enabled ? "Nonaktifkan provider IndoSMM?" : "Aktifkan provider IndoSMM? Pastikan API key dan respons sudah diuji.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/providers/indosmm/enable", { method: "POST" });
      const body = await readJsonResponse<{ data: { isEnabled: boolean }; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(body?.error?.message ?? "Perubahan gagal.");
      setEnabled(body.data.isEnabled); setMessage(body.data.isEnabled ? "Provider aktif." : "Provider dinonaktifkan.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 8, justifyItems: "start" }}><button type="button" className={enabled ? "btn btn-quiet" : "btn btn-primary"} disabled={busy} onClick={toggle}>{busy ? "Menyimpan…" : enabled ? "Nonaktifkan provider" : "Aktifkan provider"}</button>{message && <span className="muted" role="status" style={{ fontSize: 12 }}>{message}</span>}</div>;
}
