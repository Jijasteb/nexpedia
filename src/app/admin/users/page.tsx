import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, Users, WalletCards, X } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { BalanceAdjustmentForm } from "./balance-adjustment-form";
import { UserStatusAction } from "./user-status-action";

export const dynamic = "force-dynamic";
const money = (value: bigint) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
type SearchParams = Promise<{ q?: string; status?: string; role?: string; page?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await getSessionUser();
  if (!admin) redirect("/login?next=/admin/users");
  if (admin.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const status = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"].includes(params.status ?? "") ? params.status! : "";
  const role = ["USER", "ADMIN"].includes(params.role ?? "") ? params.role! : "";
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.min(100000, parsedPage)) : 1;
  const where = {
    ...(query ? { OR: [{ username: { contains: query, mode: "insensitive" as const } }, { email: { contains: query, mode: "insensitive" as const } }] } : {}),
    ...(status ? { status: status as "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" } : {}),
    ...(role ? { role: role as "USER" | "ADMIN" } : {}),
  };
  const [users, matchedUsers, totalUsers] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, select: { id: true, username: true, email: true, role: true, status: true, createdAt: true, wallet: { select: { balance: true, currency: true } } } }),
    db.user.count({ where }),
    db.user.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(matchedUsers / 50));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) redirect(`/admin/users?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { status } : {}), ...(role ? { role } : {}), page: String(safePage) }).toString()}`);
  const pageUrl = (nextPage: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (status) next.set("status", status);
    if (role) next.set("role", role);
    next.set("page", String(nextPage));
    return `/admin/users?${next.toString()}`;
  };
  const clearUrl = "/admin/users";

  return <main className="container admin-page" style={{ paddingBlock: 32 }}>
    <div className="admin-page-heading">
      <div><div className="eyebrow">Kontrol akun & saldo</div><h1>Kelola pengguna</h1><p className="muted">Cari akun, tinjau status, dan sesuaikan saldo dengan alasan yang tercatat. Riwayat transaksi keuangan tidak dihapus.</p></div>
      <Link href="/admin" className="btn btn-quiet"><ArrowLeft size={15} /> Kembali ke admin</Link>
    </div>
    <section className="admin-summary-grid">
      <article className="panel admin-summary-card"><span className="muted"><Users size={15} /> Total pengguna</span><strong>{totalUsers.toLocaleString("id-ID")}</strong><small className="muted">Seluruh akun terdaftar</small></article>
      <article className="panel admin-summary-card"><span className="muted"><Search size={15} /> Hasil pencarian</span><strong>{matchedUsers.toLocaleString("id-ID")}</strong><small className="muted">{matchedUsers ? `Halaman ${safePage} dari ${totalPages}` : "Tidak ada akun yang cocok"}</small></article>
    </section>
    <form method="get" action="/admin/users" className="panel admin-user-filters">
      <label className="admin-user-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Cari username atau email</span><input type="search" name="q" defaultValue={query} placeholder="Cari username atau email…" maxLength={100}/></label>
      <label className="admin-filter-field"><span>Status akun</span><select name="status" defaultValue={status}><option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="PENDING_VERIFICATION">Menunggu verifikasi</option><option value="SUSPENDED">Ditangguhkan</option></select></label>
      <label className="admin-filter-field"><span>Jenis akun</span><select name="role" defaultValue={role}><option value="">Semua jenis</option><option value="USER">Pengguna</option><option value="ADMIN">Admin</option></select></label>
      <button className="btn btn-primary" type="submit">Terapkan filter</button>
      {(query || status || role) && <Link href={clearUrl} className="btn btn-quiet"><X size={14}/> Reset</Link>}
    </form>
    <div className="panel admin-table-panel">
      <div className="admin-table-heading"><div><h2>Daftar pengguna</h2><p className="muted">Menampilkan {users.length ? ((safePage - 1) * 50 + 1).toLocaleString("id-ID") : 0}–{Math.min(safePage * 50, matchedUsers).toLocaleString("id-ID")} dari {matchedUsers.toLocaleString("id-ID")} akun yang cocok. Saldo tidak dapat dikurangi melewati Rp0.</p></div></div>
      <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Pengguna</th><th>Status</th><th>Saldo saat ini</th><th>Penyesuaian saldo</th><th>Aksi akun</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}>
          <td><Link href={`/admin/users/${user.id}`} className="admin-reference-link"><strong>{user.username}</strong></Link><div className="muted admin-secondary-cell">{user.email}</div><div className="admin-secondary-cell"><Link href={`/admin/users/${user.id}`} className="admin-inline-link">Lihat detail →</Link></div><div className="muted admin-secondary-cell">{user.role === "ADMIN" ? "Admin" : "Pengguna"} · Daftar {user.createdAt.toLocaleDateString("id-ID")}</div></td>
          <td><span className={`admin-status-chip ${user.status === "ACTIVE" ? "is-active" : user.status === "SUSPENDED" ? "is-danger" : "is-pending"}`}>{user.status === "ACTIVE" ? "Aktif" : user.status === "SUSPENDED" ? "Ditangguhkan" : "Menunggu verifikasi"}</span></td>
          <td className="admin-balance-cell"><strong>{money(user.wallet?.balance ?? 0n)}</strong></td>
          <td><BalanceAdjustmentForm userId={user.id} username={user.username} balance={(user.wallet?.balance ?? 0n).toString()} /></td>
          <td><UserStatusAction userId={user.id} username={user.username} status={user.status} /></td>
        </tr>)}
        {!users.length && <tr><td colSpan={5} className="admin-empty-cell">Tidak ada akun yang cocok. Coba ubah kata kunci atau filter.</td></tr>}
      </tbody></table></div>
      {matchedUsers > 50 && <nav className="admin-pagination" aria-label="Navigasi halaman pengguna"><span className="muted">Halaman {safePage} dari {totalPages}</span><div>{safePage > 1 ? <Link className="btn btn-quiet" href={pageUrl(safePage - 1)}>Sebelumnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Sebelumnya</span>}{safePage < totalPages ? <Link className="btn btn-quiet" href={pageUrl(safePage + 1)}>Berikutnya</Link> : <span className="btn btn-quiet is-disabled" aria-disabled="true">Berikutnya</span>}</div></nav>}
    </div>
  </main>;
}
