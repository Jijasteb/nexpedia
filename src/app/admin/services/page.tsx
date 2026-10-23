import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ServiceEditor } from "./service-editor";
export const dynamic = "force-dynamic";
export default async function AdminServicesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/services");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const services = await db.service.findMany({ include: { provider: true, category: { select: { name: true } } }, orderBy: [{ isActive: "asc" }, { name: "asc" }], take: 300 });
  return <main className="container" style={{ paddingBlock: 38 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}><div><div className="eyebrow">Kontrol katalog</div><h1 style={{ fontSize: 34, letterSpacing: "-.05em", margin: "8px 0" }}>Kelola layanan</h1><p className="muted" style={{ margin: 0 }}>Tinjau harga jual dan publikasikan layanan yang sudah divalidasi.</p></div><Link className="btn btn-quiet" href="/admin">Kembali ke admin</Link></div>
    <div className="panel" style={{ overflowX: "auto" }}>{services.length ? <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900, fontSize: 13 }}><thead><tr style={{ textAlign: "left", background: "#f8f8fc" }}>{["Layanan", "Kategori", "Harga dasar / 1.000", "Atur harga & status"].map((x) => <th key={x} style={{ padding: "14px 16px", color: "var(--muted)" }}>{x}</th>)}</tr></thead><tbody>{services.map((service) => <tr key={service.id} style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: "15px 16px", maxWidth: 300 }}><strong>{service.name}</strong><div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{service.provider.name} · ID {service.providerServiceId}</div></td><td style={{ padding: "15px 16px" }}>{service.category?.name ?? "Lainnya"}</td><td style={{ padding: "15px 16px", whiteSpace: "nowrap" }}>Rp {Number(service.baseRate).toLocaleString("id-ID", { maximumFractionDigits: 6 })}</td><td style={{ padding: "15px 16px" }}><ServiceEditor item={{ id: service.id, name: service.name, baseRate: service.baseRate.toString(), sellingRate: service.sellingRate.toString(), isActive: service.isActive, providerEnabled: service.provider.isEnabled }}/></td></tr>)}</tbody></table> : <p className="muted" style={{ padding: 24 }}>Belum ada layanan. Sinkronkan katalog dari panel admin.</p>}</div>
  </main>;
}
