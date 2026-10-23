import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { TicketActions } from "./ticket-actions";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const labels: Record<string, string> = { OPEN: "Terbuka", IN_PROGRESS: "Ditangani", RESOLVED: "Terselesaikan", CLOSED: "Ditutup" };
const classes: Record<string, string> = { OPEN: "is-pending", IN_PROGRESS: "is-pending", RESOLVED: "is-active", CLOSED: "is-danger" };

export default async function AdminSupportPage() {
  const admin = await getSessionUser();
  if (!admin) redirect("/login?next=/admin/support");
  if (admin.role !== "ADMIN") redirect("/dashboard");
  const [tickets, total, open, progress] = await Promise.all([
    db.supportTicket.findMany({ orderBy: { updatedAt: "desc" }, take: 150, include: { user: { select: { username: true, email: true } }, messages: { orderBy: { createdAt: "asc" }, take: 4 } } }),
    db.supportTicket.count(),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
  ]);
  return <main className="container admin-page" style={{ paddingBlock: 32 }}>
    <div className="admin-page-heading"><div><div className="eyebrow">Bantuan pelanggan</div><h1>Support inbox</h1><p className="muted">Tinjau percakapan, balas pengguna, dan perbarui status tiket dari satu tempat.</p></div><Link href="/admin" className="btn btn-quiet"><ArrowLeft size={15}/> Kembali ke admin</Link></div>
    <section className="admin-summary-grid">
      <article className="panel admin-summary-card"><span className="muted"><LifeBuoy size={15}/> Total tiket</span><strong>{total.toLocaleString("id-ID")}</strong><small className="muted">Menampilkan {tickets.length} terbaru</small></article>
      <article className="panel admin-summary-card"><span className="muted">Tiket terbuka</span><strong>{open.toLocaleString("id-ID")}</strong><small className="muted">Menunggu ditinjau</small></article>
      <article className="panel admin-summary-card"><span className="muted">Sedang ditangani</span><strong>{progress.toLocaleString("id-ID")}</strong><small className="muted">Dalam proses bantuan</small></article>
    </section>
    <div className="admin-support-list">{tickets.map((ticket) => <article className="panel admin-support-card" key={ticket.id}>
      <div className="admin-support-top"><div><div className="muted admin-secondary-cell">{ticket.id} · Diperbarui {ticket.updatedAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</div><h2>{ticket.subject}</h2><p className="muted admin-support-user">{ticket.user.username} · {ticket.user.email}</p></div><span className={`admin-status-chip ${classes[ticket.status] ?? "is-pending"}`}>{labels[ticket.status] ?? ticket.status}</span></div>
      <div className="admin-support-messages">{ticket.messages.map((message) => <div className="admin-support-message" key={message.id}><div className="admin-support-message-meta"><strong>{message.isAdmin ? "Admin" : "Pengguna"}</strong><span className="muted">{message.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span></div><p>{message.body}</p></div>)}{!ticket.messages.length && <p className="muted">Belum ada pesan pada tiket ini.</p>}</div>
      <TicketActions ticketId={ticket.id} status={ticket.status} />
    </article>)}{!tickets.length && <div className="panel admin-empty-cell">Belum ada tiket bantuan.</div>}</div>
  </main>;
}
