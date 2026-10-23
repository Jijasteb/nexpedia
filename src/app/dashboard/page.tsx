import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Clock3, CreditCard, ShoppingBag, WalletCards } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

function rupiah(value: bigint) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
}

export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  const [wallet, totalOrders, activeOrders, recentOrders, ledger] = await Promise.all([
    db.wallet.findUnique({ where: { userId: user.id }, select: { balance: true, currency: true } }),
    db.order.count({ where: { userId: user.id } }),
    db.order.count({ where: { userId: user.id, status: { in: ["PENDING", "SUBMITTING", "SUBMISSION_UNKNOWN", "PROCESSING", "IN_PROGRESS"] } } }),
    db.order.findMany({ where: { userId: user.id }, include: { service: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.walletLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, type: true, amount: true, createdAt: true, reason: true } }),
  ]);
  const stats = [
    { label: "Saldo tersedia", value: rupiah(wallet?.balance ?? 0n), detail: "Saldo akun", icon: WalletCards },
    { label: "Total pesanan", value: String(totalOrders), detail: "Semua pesanan", icon: ShoppingBag },
    { label: "Sedang diproses", value: String(activeOrders), detail: "Pesanan aktif", icon: Clock3 },
  ];
  return <main className="container" style={{ paddingBlock: 36 }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
      <div><div className="eyebrow">Ruang kerja</div><h1 style={{ fontSize: 32, letterSpacing: "-.05em", margin: "8px 0" }}>Halo, {user.username}</h1><p className="muted" style={{ margin: 0 }}>Ringkasan akun dan aktivitas terbaru Anda.</p></div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}><Link className="btn btn-quiet" href="/services">Jelajahi layanan</Link><Link className="btn btn-quiet" href="/dashboard/deposits">Tambah saldo</Link><Link className="btn btn-primary" href="/dashboard/orders/new">Buat pesanan <ArrowUpRight size={15}/></Link></div>
    </header>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 22 }}>
      {stats.map(({ label, value, detail, icon: Icon }) => <article className="panel" key={label} style={{ padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="muted" style={{ fontSize: 13 }}>{label}</span><Icon size={18} color="var(--primary)"/></div><div style={{ fontSize: 27, fontWeight: 760, letterSpacing: "-.04em", marginTop: 16 }}>{value}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{detail}</div></article>)}
    </section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
      <article className="panel" style={{ padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 17 }}>Pesanan terbaru</h2><Link href="/dashboard/orders" style={{ color: "var(--primary)", fontSize: 12 }}>Lihat semua</Link></div>
        {recentOrders.length ? recentOrders.map((order) => <div key={order.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBlock: 13, borderTop: "1px solid var(--border)" }}><div style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "#f0efff", color: "var(--primary)" }}><ShoppingBag size={16}/></div><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.service.name}</div><div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{order.internalReference} · {order.quantity.toLocaleString("id-ID")} unit</div></div><span style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, background: "#f3f4f8" }}>{order.status.replaceAll("_", " ")}</span></div>) : <p className="muted" style={{ fontSize: 13, paddingBlock: 14 }}>Belum ada pesanan. Pilih layanan untuk memulai.</p>}
      </article>
      <article className="panel" style={{ padding: 20 }}><div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}><CreditCard size={18} color="var(--primary)"/><h2 style={{ margin: 0, fontSize: 17 }}>Aktivitas saldo</h2></div>
        {ledger.length ? ledger.map((entry) => <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBlock: 13, borderTop: "1px solid var(--border)" }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 650 }}>{entry.reason || entry.type.replaceAll("_", " ")}</div><div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{entry.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</div></div><strong style={{ fontSize: 13, color: entry.amount < 0n ? "#b42318" : "#16805d" }}>{entry.amount > 0n ? "+" : "−"}{rupiah(entry.amount < 0n ? -entry.amount : entry.amount)}</strong></div>) : <p className="muted" style={{ fontSize: 13, paddingBlock: 14 }}>Belum ada transaksi saldo.</p>}
      </article>
    </section>
  </main>;
}
