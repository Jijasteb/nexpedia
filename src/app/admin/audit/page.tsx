import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const date = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(value);
const actionLabel: Record<string, string> = { WALLET_BALANCE_ADDED: "Saldo ditambahkan", WALLET_BALANCE_DEDUCTED: "Saldo dikurangi", SERVICE_UPDATED: "Layanan diperbarui", PROVIDER_SYNCED: "Provider disinkronkan", USER_SUSPENDED: "Pengguna ditangguhkan", USER_REACTIVATED: "Pengguna diaktifkan kembali", SUPPORT_REPLY_SENT: "Balasan support dikirim", SUPPORT_TICKET_STATUS_UPDATED: "Status tiket diperbarui" };
export default async function AdminAuditPage() {
  const admin = await getSessionUser();
  if (!admin) redirect("/login?next=/admin/audit");
  if (admin.role !== "ADMIN") redirect("/dashboard");
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 150 });
  return <main className="container admin-page" style={{ paddingBlock: 32 }}>
    <div className="admin-page-heading"><div><div className="eyebrow">Keamanan & akuntabilitas</div><h1>Audit aktivitas</h1><p className="muted">Riwayat tindakan admin untuk membantu penelusuran perubahan akun, saldo, dan layanan.</p></div><Link href="/admin" className="btn btn-quiet"><ArrowLeft size={15}/> Kembali ke admin</Link></div>
    <section className="panel admin-table-panel"><div className="admin-table-heading"><div><h2><ClipboardList size={17} style={{ verticalAlign: "-3px", marginRight: 8 }}/>Aktivitas terbaru</h2><p className="muted">Menampilkan hingga 150 catatan terbaru. Catatan audit tidak dapat dihapus dari halaman ini.</p></div></div>
      <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Waktu</th><th>Tindakan</th><th>Objek</th><th>Detail</th></tr></thead><tbody>
        {logs.map((log) => { const meta = log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? log.metadata as Record<string, unknown> : {}; return <tr key={log.id}><td>{date(log.createdAt)}</td><td><strong>{actionLabel[log.action] ?? log.action.replaceAll("_", " ").toLowerCase()}</strong><div className="muted admin-secondary-cell">{log.action}</div></td><td>{log.targetType}{log.targetId ? <div className="muted admin-secondary-cell">{log.targetId}</div> : null}</td><td><div>{typeof meta.username === "string" ? `Pengguna: ${meta.username}` : "—"}</div>{typeof meta.amount === "string" ? <div className="muted admin-secondary-cell">Nominal: Rp {meta.amount}</div> : null}{typeof meta.reason === "string" ? <div className="muted admin-secondary-cell">Alasan: {meta.reason}</div> : null}{typeof meta.balanceAfter === "string" ? <div className="muted admin-secondary-cell">Saldo akhir: Rp {meta.balanceAfter}</div> : null}</td></tr>; })}
        {!logs.length && <tr><td colSpan={4} className="admin-empty-cell">Belum ada aktivitas yang tercatat.</td></tr>}
      </tbody></table></div>
    </section>
  </main>;
}
