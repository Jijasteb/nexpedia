import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, WalletCards, X } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const money = (value: bigint) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
const statuses = ["PENDING", "PAID", "EXPIRED", "FAILED", "CANCELED"] as const;
const statusLabel: Record<string, string> = { PENDING: "Menunggu pembayaran", PAID: "Dibayar", EXPIRED: "Kedaluwarsa", FAILED: "Gagal", CANCELED: "Dibatalkan" };
const statusClass = (status: string) => status === "PAID" ? "is-active" : ["FAILED", "CANCELED", "EXPIRED"].includes(status) ? "is-danger" : "is-pending";
type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

export default async function AdminDepositsPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await getSessionUser();
  if (!admin) redirect("/login?next=/admin/deposits");
  if (admin.role !== "ADMIN") redirect("/dashboard");
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const status = statuses.includes(params.status as typeof statuses[number]) ? params.status! : "";
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.min(100000, parsedPage)) : 1;
  const where = {
    ...(status ? { status: status as typeof statuses[number] } : {}),
    ...(query ? { OR: [
      { internalOrderId: { contains: query, mode: "insensitive" as const } },
      { providerOrderId: { contains: query, mode: "insensitive" as const } },
      { paymentMethod: { contains: query, mode: "insensitive" as const } },
      { user: { username: { contains: query, mode: "insensitive" as const } } },
      { user: { email: { contains: query, mode: "insensitive" as const } } },
    ] } : {}),
  };
  const [deposits, matched, total, pending, paid] = await Promise.all([
    db.deposit.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { user: { select: { username: true, email: true } } } }),
    db.deposit.count({ where }), db.deposit.count(), db.deposit.count({ where: { status: "PENDING" } }), db.deposit.count({ where: { status: "PAID" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(matched / 50));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) redirect(`/admin/deposits?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { status } : {}), page: String(safePage) }).toString()}`);
  const pageUrl = (nextPage: number) => { const next = new URLSearchParams(); if (query) next.set("q", query); if (status) next.set("status", status); next.set("page", String(nextPage)); return `/admin/deposits?${next.toString()}`; };
  return <main className="container admin-page" style={{ paddingBlock: 32 }}>
    <div className="admin-page-heading"><div><div className="eyebrow">Operasional pembayaran</div><h1>Kelola deposit</h1><p className="muted">Cari referensi, pengguna, atau metode pembayaran. Status pembayaran tidak bisa ditandai lunas secara manual.</p></div><Link href="/admin" className="btn btn-quiet"><ArrowLeft size={15}/> Kembali ke admin</Link></div>
    <section className="admin-summary-grid"><article className="panel admin-summary-card"><span className="muted"><WalletCards size={15}/> Total deposit</span><strong>{total.toLocaleString("id-ID")}</strong><small className="muted">Semua status</small></article><article className="panel admin-summary-card"><span className="muted">Menunggu pembayaran</span><strong>{pending.toLocaleString("id-ID")}</strong><small className="muted">Menunggu konfirmasi gateway</small></article><article className="panel admin-summary-card"><span className="muted">Sudah dibayar</span><strong>{paid.toLocaleString("id-ID")}</strong><small className="muted">Tercatat sebagai PAID</small></article><article className="panel admin-summary-card"><span className="muted"><Search size={15}/> Hasil filter</span><strong>{matched.toLocaleString("id-ID")}</strong><small className="muted">{matched ? `Halaman ${safePage} dari ${totalPages}` : "Tidak ada deposit yang cocok"}</small></article></section>
    <form method="get" action="/admin/deposits" className="panel admin-user-filters"><label className="admin-user-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Cari deposit</span><input type="search" name="q" defaultValue={query} placeholder="Cari referensi, username, email, metode…" maxLength={100}/></label><label className="admin-filter-field"><span>Status deposit</span><select name="status" defaultValue={status}><option value="">Semua status</option>{statuses.map((s) => <option value={s} key={s}>{statusLabel[s]}</option>)}</select></label><button className="btn btn-primary" type="submit">Terapkan filter</button>{(query || status) && <Link href="/admin/deposits" className="btn btn-quiet"><X size={14}/> Reset</Link>}</form>
    <div className="panel admin-table-panel"><div className="admin-table-heading"><div><h2>Deposit</h2><p className="muted">Menampilkan {deposits.length ? ((safePage - 1) * 50 + 1).toLocaleString("id-ID") : 0}–{Math.min(safePage * 50, matched).toLocaleString("id-ID")} dari {matched.toLocaleString("id-ID")} deposit yang cocok. Verifikasi pembayaran melalui gateway.</p></div></div><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Referensi</th><th>Pengguna</th><th>Nominal</th><th>Metode</th><th>Status</th><th>Kedaluwarsa</th><th>Dibuat</th></tr></thead><tbody>{deposits.map((deposit) => <tr key={deposit.id}><td><Link href={`/admin/deposits/${deposit.id}`} className="admin-reference-link"><strong>{deposit.internalOrderId}</strong></Link><div className="muted admin-secondary-cell">Provider: {deposit.providerOrderId ?? "—"}</div><div className="admin-secondary-cell"><Link href={`/admin/deposits/${deposit.id}`} className="admin-inline-link">Lihat detail →</Link></div></td><td><strong>{deposit.user.username}</strong><div className="muted admin-secondary-cell">{deposit.user.email}</div></td><td><strong>{money(deposit.amount)}</strong>{deposit.feeAmount > 0n && <div className="muted admin-secondary-cell">Biaya {money(deposit.feeAmount)}</div>}</td><td>{deposit.paymentMethod ?? "—"}</td><td><span className={`admin-status-chip ${statusClass(deposit.status)}`}>{statusLabel[deposit.status] ?? deposit.status}</span></td><td>{deposit.expiresAt ? deposit.expiresAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td><td>{deposit.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}{!deposits.length && <tr><td colSpan={7} className="admin-empty-cell">Tidak ada deposit yang cocok. Coba ubah kata kunci atau filter.</td></tr>}</tbody></table></div>{matched > 50 && <nav className="admin-pagination" aria-label="Navigasi halaman deposit"><span className="muted">Halaman {safePage} dari {totalPages}</span><div>{safePage > 1 ? <Link className="btn btn-quiet" href={pageUrl(safePage - 1)}>Sebelumnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Sebelumnya</span>}{safePage < totalPages ? <Link className="btn btn-quiet" href={pageUrl(safePage + 1)}>Berikutnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Berikutnya</span>}</div></nav>}</div>
  </main>;
}
