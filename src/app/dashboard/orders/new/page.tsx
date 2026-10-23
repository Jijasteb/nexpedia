import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { NewOrderForm } from "./new-order-form";

export const dynamic = "force-dynamic";
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/orders/new");
  const params = await searchParams;
  const services = await db.service.findMany({ where: { isActive: true, provider: { isEnabled: true, name: { contains: "IndoSMM", mode: "insensitive" } } }, select: { id: true, name: true, sellingRate: true, minQuantity: true, maxQuantity: true }, orderBy: { name: "asc" }, take: 500 });
  return <main className="container new-order-page" style={{ paddingBlock: 34, maxWidth: 1000 }}><div className="eyebrow">Ruang pelanggan</div><h1 style={{ fontSize: "clamp(28px, 4vw, 36px)", letterSpacing: "-.05em", margin: "8px 0" }}>Pesanan baru</h1><p className="muted" style={{ lineHeight: 1.8, marginBottom: 24, fontSize: 13 }}>Pilih layanan, masukkan target, dan periksa estimasi biaya sebelum konfirmasi.</p><NewOrderForm services={services.map((s) => ({ ...s, sellingRate: s.sellingRate.toString() }))} initialService={params.service ?? ""} /></main>;
}
