import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, WalletCards, X } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const money = (value: bigint) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
const types = ["DEPOSIT", "ORDER_DEBIT", "REFUND", "ADJUSTMENT"] as const;
const typeLabel: Record<string, string> = { DEPOSIT: "Deposit", ORDER_DEBIT: "Pembayaran pesanan", REFUND: "Pengembalian dana", ADJUSTMENT: "Penyesuaian saldo" };
const typeClass = (type: string) => type === "DEPOSIT" || type === "REFUND" ? "is-active" : type === "ORDER_DEBIT" ? "is-danger" : "is-pending";
type SearchParams = Promise<{ q?: string; type?: string; page?: string }>;

export default async function AdminTransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await getSessionUser();
  if (!admin) redirect("/login?next=/admin/transactions");
  if (admin.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const type = types.includes(params.type as typeof types[number]) ? params.type! : "";
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.min(100000, parsedPage)) : 1;
  const where = {
    ...(type ? { type: type as typeof types[number] } : {}),
    ...(query ? { OR: [
      { id: { contains: query, mode: "insensitive" as const } },
      { referenceId: { contains: query, mode: "insensitive" as const } },
      { reason: { contains: query, mode: "insensitive" as const } },
      { user: { username: { contains: query, mode: "insensitive" as const } } },
      { user: { email: { contains: query, mode: "insensitive" as const } } },
      { transaction: { id: { contains: query, mode: "insensitive" as const } } },
    ] } : {}),
  };
  const [entries, matched, total, posted, reversed] = await Promise.all([
    db.walletLedger.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { user: { select: { username: true, email: true } }, transaction: { select: { id: true, status: true, description: true } } } }),
    db.walletLedger.count({ where }), db.walletLedger.count(), db.walletLedger.count({ where: { status: "POSTED" } }), db.walletLedger.count({ where: { status: "REVERSED" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(matched / 50));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) redirect(`/admin/transactions?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(type ? { type } : {}), page: String(safePage) }).toString()}`);
  const pageUrl = (nextPage: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (type) next.set("type", type);
    next.set("page", String(nextPage));
    return `/admin/transactions?${next.toString()}`;
  };

  return <main className="container admin-page" style={{ paddingBlock: 32 }}>
    <div className="admin-page-heading"><div><div className="eyebrow">Keuangan & akuntabilitas</div><h1>Riwayat transaksi</h1><p className="muted">Riwayat ledger saldo yang tercatat. Halaman ini hanya untuk peninjauan; tidak ada perubahan saldo dari tabel ini.</p></div><Link href="/admin" className="btn btn-quiet"><ArrowLeft size={15}/> Kembali ke admin</Link></div>
    <section className="admin-summary-grid">
      <article className="panel admin-summary-card"><span className="muted"><WalletCards size={15}/> Total entri ledger</span><strong>{total.toLocaleString("id-ID")}</strong><small className="muted">Semua jenis transaksi</small></article>
      <article className="panel admin-summary-card"><span className="muted">Tercatat aktif</span><strong>{posted.toLocaleString("id-ID")}</strong><small className="muted">Status POSTED</small></article>
      <article className="panel admin-summary-card"><span className="muted">Dibalikkan</span><strong>{reversed.toLocaleString("id-ID")}</strong><small className="muted">Status REVERSED</small></article>
      <article className="panel admin-summary-card"><span className="muted"><Search size={15}/> Hasil filter</span><strong>{matched.toLocaleString("id-ID")}</strong><small className="muted">{matched ? `Halaman ${safePage} dari ${totalPages}` : "Tidak ada transaksi yang cocok"}</small></article>
    </section>
    <form method="get" action="/admin/transactions" className="panel admin-user-filters">
      <label className="admin-user-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Cari transaksi</span><input type="search" name="q" defaultValue={query} placeholder="Cari ID, referensi, username, email, alasan…" maxLength={100}/></label>
      <label className="admin-filter-field"><span>Jenis transaksi</span><select name="type" defaultValue={type}><option value="">Semua jenis</option>{types.map((item) => <option key={item} value={item}>{typeLabel[item]}</option>)}</select></label>
      <button className="btn btn-primary" type="submit">Terapkan filter</button>
      {(query || type) && <Link href="/admin/transactions" className="btn btn-quiet"><X size={14}/> Reset</Link>}
    </form>
    <div className="panel admin-table-panel"><div className="admin-table-heading"><div><h2>Entri ledger</h2><p className="muted">Menampilkan {entries.length ? ((safePage - 1) * 50 + 1).toLocaleString("id-ID") : 0}–{Math.min(safePage * 50, matched).toLocaleString("id-ID")} dari {matched.toLocaleString("id-ID")} entri yang cocok.</p></div></div>
      <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Jenis</th><th>Nominal</th><th>Saldo sebelum → sesudah</th><th>Referensi & detail</th><th>Status</th></tr></thead><tbody>
        {entries.map((entry) => <tr key={entry.id}><td>{entry.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}<div className="muted admin-secondary-cell">Ledger: {entry.id.slice(0, 12)}…</div></td><td><strong>{entry.user.username}</strong><div className="muted admin-secondary-cell">{entry.user.email}</div></td><td><strong>{typeLabel[entry.type] ?? entry.type}</strong><div className="muted admin-secondary-cell">{entry.type}</div></td><td><strong>{money(entry.amount)}</strong></td><td>{money(entry.balanceBefore)}<div className="muted admin-secondary-cell">→ {money(entry.balanceAfter)}</div></td><td>{entry.referenceId ?? entry.transactionId}<div className="muted admin-secondary-cell">{entry.reason ?? entry.transaction.description ?? "—"}</div></td><td><span className={`admin-status-chip ${entry.status === "POSTED" ? "is-active" : "is-danger"}`}>{entry.status === "POSTED" ? "Tercatat" : "Dibalikkan"}</span></td></tr>)}
        {!entries.length && <tr><td colSpan={7} className="admin-empty-cell">Tidak ada entri ledger yang cocok. Coba ubah kata kunci atau filter.</td></tr>}
      </tbody></table></div>
      {matched > 50 && <nav className="admin-pagination" aria-label="Navigasi halaman transaksi"><span className="muted">Halaman {safePage} dari {totalPages}</span><div>{safePage > 1 ? <Link className="btn btn-quiet" href={pageUrl(safePage - 1)}>Sebelumnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Sebelumnya</span>}{safePage < totalPages ? <Link className="btn btn-quiet" href={pageUrl(safePage + 1)}>Berikutnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Berikutnya</span>}</div></nav>}
    </div>
  </main>;
}
