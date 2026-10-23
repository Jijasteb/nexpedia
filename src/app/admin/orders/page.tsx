import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, ShoppingBag, X } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const money = (value: bigint) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
const statuses = ["PENDING", "SUBMITTING", "SUBMISSION_UNKNOWN", "PROCESSING", "IN_PROGRESS", "COMPLETED", "PARTIAL", "CANCELED", "FAILED"] as const;
const statusLabel: Record<string, string> = { PENDING: "Menunggu", SUBMITTING: "Mengirim", SUBMISSION_UNKNOWN: "Perlu rekonsiliasi", PROCESSING: "Diproses", IN_PROGRESS: "Berjalan", COMPLETED: "Selesai", PARTIAL: "Sebagian", CANCELED: "Dibatalkan", FAILED: "Gagal" };
const statusClass = (status: string) => status === "COMPLETED" ? "is-active" : ["FAILED", "CANCELED", "SUBMISSION_UNKNOWN"].includes(status) ? "is-danger" : "is-pending";
type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await getSessionUser();
  if (!admin) redirect("/login?next=/admin/orders");
  if (admin.role !== "ADMIN") redirect("/dashboard");
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const status = statuses.includes(params.status as typeof statuses[number]) ? params.status! : "";
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.min(100000, parsedPage)) : 1;
  const where = {
    ...(status ? { status: status as typeof statuses[number] } : {}),
    ...(query ? { OR: [
      { internalReference: { contains: query, mode: "insensitive" as const } },
      { providerOrderId: { contains: query, mode: "insensitive" as const } },
      { user: { username: { contains: query, mode: "insensitive" as const } } },
      { user: { email: { contains: query, mode: "insensitive" as const } } },
      { service: { name: { contains: query, mode: "insensitive" as const } } },
    ] } : {}),
  };
  const [orders, matched, total, uncertain] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { user: { select: { username: true, email: true } }, service: { select: { name: true, provider: { select: { name: true } } } } } }),
    db.order.count({ where }), db.order.count(), db.order.count({ where: { status: "SUBMISSION_UNKNOWN" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(matched / 50));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) redirect(`/admin/orders?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { status } : {}), page: String(safePage) }).toString()}`);
  const pageUrl = (nextPage: number) => { const next = new URLSearchParams(); if (query) next.set("q", query); if (status) next.set("status", status); next.set("page", String(nextPage)); return `/admin/orders?${next.toString()}`; };
  return <main className="container admin-page" style={{ paddingBlock: 32 }}>
    <div className="admin-page-heading"><div><div className="eyebrow">Operasional transaksi</div><h1>Kelola pesanan</h1><p className="muted">Cari pesanan berdasarkan referensi, pengguna, atau layanan. Status provider tidak diubah manual dari halaman ini.</p></div><Link href="/admin" className="btn btn-quiet"><ArrowLeft size={15}/> Kembali ke admin</Link></div>
    <section className="admin-summary-grid"><article className="panel admin-summary-card"><span className="muted"><ShoppingBag size={15}/> Total pesanan</span><strong>{total.toLocaleString("id-ID")}</strong><small className="muted">Semua status</small></article><article className="panel admin-summary-card"><span className="muted">Perlu rekonsiliasi</span><strong>{uncertain.toLocaleString("id-ID")}</strong><small className="muted">Pastikan status provider sebelum tindakan lanjutan</small></article><article className="panel admin-summary-card"><span className="muted"><Search size={15}/> Hasil filter</span><strong>{matched.toLocaleString("id-ID")}</strong><small className="muted">{matched ? `Halaman ${safePage} dari ${totalPages}` : "Tidak ada pesanan yang cocok"}</small></article></section>
    <form method="get" action="/admin/orders" className="panel admin-user-filters"><label className="admin-user-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Cari pesanan</span><input type="search" name="q" defaultValue={query} placeholder="Cari referensi, username, email, layanan…" maxLength={100}/></label><label className="admin-filter-field"><span>Status pesanan</span><select name="status" defaultValue={status}><option value="">Semua status</option>{statuses.map((s) => <option value={s} key={s}>{statusLabel[s]}</option>)}</select></label><button className="btn btn-primary" type="submit">Terapkan filter</button>{(query || status) && <Link href="/admin/orders" className="btn btn-quiet"><X size={14}/> Reset</Link>}</form>
    <div className="panel admin-table-panel"><div className="admin-table-heading"><div><h2>Pesanan</h2><p className="muted">Menampilkan {orders.length ? ((safePage - 1) * 50 + 1).toLocaleString("id-ID") : 0}–{Math.min(safePage * 50, matched).toLocaleString("id-ID")} dari {matched.toLocaleString("id-ID")} pesanan yang cocok.</p></div></div><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Pesanan</th><th>Pengguna</th><th>Layanan</th><th>Jumlah</th><th>Biaya</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`} className="admin-order-reference"><strong>{order.internalReference}</strong></Link><div className="muted admin-secondary-cell">Provider ID: {order.providerOrderId ?? "—"}</div><div className="admin-secondary-cell"><Link href={`/admin/orders/${order.id}`}>Lihat detail →</Link></div></td><td><strong>{order.user.username}</strong><div className="muted admin-secondary-cell">{order.user.email}</div></td><td><strong>{order.service.name}</strong><div className="muted admin-secondary-cell">{order.service.provider.name}</div></td><td>{order.quantity.toLocaleString("id-ID")}</td><td><strong>{money(order.charge)}</strong></td><td><span className={`admin-status-chip ${statusClass(order.status)}`}>{statusLabel[order.status] ?? order.status}</span></td><td>{order.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}{!orders.length && <tr><td colSpan={7} className="admin-empty-cell">Tidak ada pesanan yang cocok. Coba ubah kata kunci atau filter.</td></tr>}</tbody></table></div>{matched > 50 && <nav className="admin-pagination" aria-label="Navigasi halaman pesanan"><span className="muted">Halaman {safePage} dari {totalPages}</span><div>{safePage > 1 ? <Link className="btn btn-quiet" href={pageUrl(safePage - 1)}>Sebelumnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Sebelumnya</span>}{safePage < totalPages ? <Link className="btn btn-quiet" href={pageUrl(safePage + 1)}>Berikutnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Berikutnya</span>}</div></nav>}</div>
  </main>;
}
