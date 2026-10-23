"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send } from "lucide-react";

type Props = { ticketId: string; status: string };
const statuses = [
  { value: "OPEN", label: "Terbuka" },
  { value: "IN_PROGRESS", label: "Sedang ditangani" },
  { value: "RESOLVED", label: "Terselesaikan" },
  { value: "CLOSED", label: "Ditutup" },
];

export function TicketActions({ ticketId, status }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState(status);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = message.trim();
    if (!body && nextStatus === status) {
      setNotice({ kind: "error", text: "Tulis balasan atau ubah status tiket." });
      return;
    }
    if (body.length > 4000) {
      setNotice({ kind: "error", text: "Balasan maksimal 4.000 karakter." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(ticketId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(body ? { message: body } : {}), ...(nextStatus !== status ? { status: nextStatus } : {}) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false || result?.success === false) {
        throw new Error(result?.error?.message ?? result?.message ?? "Perubahan gagal disimpan.");
      }
      setMessage("");
      setNotice({ kind: "success", text: "Tiket berhasil diperbarui." });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Terjadi kesalahan." });
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="admin-ticket-actions">
    <label className="admin-ticket-status-label">Status tiket
      <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={busy}>
        {statuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
      </select>
    </label>
    <label className="admin-ticket-reply-label">Balasan admin
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={4000} placeholder="Tulis balasan yang akan terlihat oleh pengguna…" disabled={busy} />
      <span className="muted admin-ticket-counter">{message.length}/4000 karakter</span>
    </label>
    {notice && <p role="status" aria-live="polite" className={notice.kind === "success" ? "admin-ticket-notice success" : "admin-ticket-notice error"}>{notice.text}</p>}
    <button className="btn btn-primary admin-ticket-submit" type="submit" disabled={busy}>
      {busy ? <LoaderCircle size={16} className="spin" /> : <Send size={15} />}
      {busy ? "Menyimpan…" : "Simpan perubahan"}
    </button>
  </form>;
}
