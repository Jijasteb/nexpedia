import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ReceiptText, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const money = (value: bigint) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
const statusLabel: Record<string, string> = { PENDING: "Menunggu pembayaran", PAID: "Dibayar", EXPIRED: "Kedaluwarsa", FAILED: "Gagal", CANCELED: "Dibatalkan" };
const statusClass = (status: string) => status === "PAID" ? "is-active" : ["FAILED", "CANCELED", "EXPIRED"].includes(status) ? "is-danger" : "is-pending";
type PageProps = { params: Promise<{ id: string }> };

export default async function AdminDepositDetailPage({ params }: PageProps) {
  const admin = await getSessionUser();
  if (!admin) redirect("/login?next=/admin/deposits");
  if (admin.role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const deposit = await db.deposit.findUnique({ where: { id }, include: { user: { select: { id: true, username: true, email: true, status: true, createdAt: true } } } });
  if (!deposit) notFound();

  // Payloads are intentionally not rendered: payment webhook payloads may contain sensitive provider data.
  const events = await db.paymentEvent.findMany({ where: { orderId: deposit.internalOrderId }, orderBy: { receivedAt: "desc" }, take: 30, select: { id: true, provider: true, providerEventId: true, status: true, receivedAt: true, processedAt: true, failureReason: true } });
  const ledger = await db.walletLedger.findMany({ where: { userId: deposit.userId, referenceId: deposit.internalOrderId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, status: true, createdAt: true, reason: true } });
  const externalCheckout = deposit.checkoutUrl && /^https:\/\//i.test(deposit.checkoutUrl) ? deposit.checkoutUrl : null;
  const externalQr = deposit.qrUrl && /^https:\/\//i.test(deposit.qrUrl) ? deposit.qrUrl : null;

  return <main className="container admin-page" style={{ paddingBlock: 32 }}>
    <div className="admin-page-heading"><div><div className="eyebrow">Operasional pembayaran</div><h1>Detail deposit</h1><p className="muted">Tinjau referensi, status gateway, dan pencatatan saldo tanpa mengubah status pembayaran secara manual.</p></div><Link href="/admin/deposits" className="btn btn-quiet"><ArrowLeft size={15}/> Kembali ke deposit</Link></div>
    <section className="admin-summary-grid">
      <article className="panel admin-summary-card"><span className="muted"><ReceiptText size={15}/> Nominal deposit</span><strong>{money(deposit.amount)}</strong><small className="muted">Biaya: {money(deposit.feeAmount)}</small></article>
      <article className="panel admin-summary-card"><span className="muted">Status saat ini</span><strong><span className={`admin-status-chip ${statusClass(deposit.status)}`}>{statusLabel[deposit.status] ?? deposit.status}</span></strong><small className="muted">Status database deposit</small></article>
      <article className="panel admin-summary-card"><span className="muted">Event pembayaran</span><strong>{events.length}</strong><small className="muted">Maksimal 30 event terbaru</small></article>
      <article className="panel admin-summary-card"><span className="muted">Entri ledger terkait</span><strong>{ledger.length}</strong><small className="muted">Berdasarkan referensi deposit</small></article>
    </section>
    <div className="admin-detail-columns">
      <section className="panel admin-table-panel admin-detail-panel"><div className="admin-table-heading"><div><h2>Informasi deposit</h2><p className="muted">Referensi internal dan detail pembayaran.</p></div></div><dl className="admin-order-detail-grid">
        <div><dt>Referensi internal</dt><dd>{deposit.internalOrderId}</dd></div>
        <div><dt>ID deposit</dt><dd>{deposit.id}</dd></div>
        <div><dt>ID provider</dt><dd>{deposit.providerOrderId ?? "—"}</dd></div>
        <div><dt>Metode pembayaran</dt><dd>{deposit.paymentMethod ?? "Belum ditentukan"}</dd></div>
        <div><dt>Nominal</dt><dd>{money(deposit.amount)}</dd></div>
        <div><dt>Biaya</dt><dd>{money(deposit.feeAmount)}</dd></div>
        <div><dt>Total nominal + biaya</dt><dd>{money(deposit.amount + deposit.feeAmount)}</dd></div>
        <div><dt>Mata uang</dt><dd>{deposit.currency}</dd></div>
        <div><dt>Dibuat</dt><dd>{deposit.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
        <div><dt>Diperbarui</dt><dd>{deposit.updatedAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
        <div><dt>Kedaluwarsa</dt><dd>{deposit.expiresAt?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) ?? "—"}</dd></div>
        <div><dt>Waktu pembayaran</dt><dd>{deposit.paidAt?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) ?? "Belum tercatat"}</dd></div>
        <div><dt>Checkout gateway</dt><dd>{externalCheckout ? <a href={externalCheckout} target="_blank" rel="noreferrer">Buka checkout <ExternalLink size={13} style={{ display: "inline" }}/></a> : "Tidak tersedia"}</dd></div>
        <div><dt>QR pembayaran</dt><dd>{externalQr ? <a href={externalQr} target="_blank" rel="noreferrer">Buka QR <ExternalLink size={13} style={{ display: "inline" }}/></a> : "Tidak tersedia"}</dd></div>
      </dl></section>
      <section className="panel admin-table-panel admin-detail-panel"><div className="admin-table-heading"><div><h2>Pengguna</h2><p className="muted">Akun yang membuat deposit.</p></div></div><dl className="admin-order-detail-grid">
        <div><dt>Username</dt><dd><Link href={`/admin/users?q=${encodeURIComponent(deposit.user.username)}`}>{deposit.user.username}</Link></dd></div>
        <div><dt>Email</dt><dd>{deposit.user.email}</dd></div>
        <div><dt>Status akun</dt><dd>{deposit.user.status}</dd></div>
        <div><dt>Terdaftar sejak</dt><dd>{deposit.user.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
      </dl><div className="admin-detail-note"><ShieldCheck size={16}/><p>Untuk menjaga integritas keuangan, status deposit tidak bisa diubah dari halaman ini. Verifikasi harus berasal dari payment gateway yang valid.</p></div></section>
    </div>
    <section className="panel admin-table-panel" style={{ marginTop: 18 }}><div className="admin-table-heading"><div><h2>Event payment gateway</h2><p className="muted">Metadata event saja; payload mentah disembunyikan demi keamanan.</p></div></div><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Diterima</th><th>Provider</th><th>ID event</th><th>Status event</th><th>Diproses</th><th>Catatan kegagalan</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.receivedAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td><td>{event.provider}</td><td>{event.providerEventId ?? "—"}</td><td><span className={`admin-status-chip ${event.status === "PROCESSED" ? "is-active" : event.status === "REJECTED" ? "is-danger" : "is-pending"}`}>{event.status}</span></td><td>{event.processedAt?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) ?? "—"}</td><td>{event.failureReason ?? "—"}</td></tr>)}{!events.length && <tr><td colSpan={6} className="admin-empty-cell">Belum ada event pembayaran yang cocok dengan referensi ini.</td></tr>}</tbody></table></div></section>
    <section className="panel admin-table-panel" style={{ marginTop: 18 }}><div className="admin-table-heading"><div><h2>Ledger saldo terkait</h2><p className="muted">Entri ledger yang memakai referensi deposit ini.</p></div></div><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Waktu</th><th>Jenis</th><th>Nominal</th><th>Saldo sebelum → sesudah</th><th>Status</th><th>Alasan</th></tr></thead><tbody>{ledger.map((entry) => <tr key={entry.id}><td>{entry.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td><td>{entry.type}</td><td>{money(entry.amount)}</td><td>{money(entry.balanceBefore)}<div className="muted admin-secondary-cell">→ {money(entry.balanceAfter)}</div></td><td><span className={`admin-status-chip ${entry.status === "POSTED" ? "is-active" : "is-danger"}`}>{entry.status}</span></td><td>{entry.reason ?? "—"}</td></tr>)}{!ledger.length && <tr><td colSpan={6} className="admin-empty-cell">Belum ada entri ledger dengan referensi ini.</td></tr>}</tbody></table></div></section>
  </main>;
}
