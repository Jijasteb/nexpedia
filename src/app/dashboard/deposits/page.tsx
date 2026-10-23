import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import DepositForm from "./deposit-form";

export const dynamic = "force-dynamic";
const rupiah = (amount: bigint) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(amount));
export default async function DepositsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/deposits");
  const deposits = await db.deposit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return <main className="container" style={{ paddingBlock: 36 }}><div style={{ marginBottom: 24 }}><Link href="/dashboard" className="muted" style={{ fontSize: 13 }}>← Kembali ke dashboard</Link><div className="eyebrow" style={{ marginTop: 16 }}>Saldo & pembayaran</div><h1 style={{ fontSize: 32, letterSpacing: "-.05em", margin: "8px 0" }}>Deposit saldo</h1><p className="muted">Buat permintaan pembayaran dan pantau status deposit.</p></div>
    <DepositForm />
    <section className="panel" style={{ padding: 22, marginTop: 22 }}><h2 style={{ marginTop: 0, fontSize: 18 }}>Riwayat deposit</h2>{deposits.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["Referensi", "Nominal", "Status", "Tanggal", "Pembayaran"].map(x => <th key={x} style={{ textAlign: "left", padding: 10, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>{x}</th>)}</tr></thead><tbody>{deposits.map(d => <tr key={d.id}><td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{d.internalOrderId}</td><td style={{ padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{rupiah(d.amount)}</td><td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{d.status}</td><td style={{ padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{d.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td><td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{d.checkoutUrl ? <a href={d.checkoutUrl} target="_blank" rel="noreferrer">Buka link</a> : "—"}</td></tr>)}</tbody></table></div> : <p className="muted" style={{ fontSize: 13 }}>Belum ada riwayat deposit.</p>}</section>
  </main>;
}
