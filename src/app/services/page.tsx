import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ServicesCatalog } from "./services-catalog";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function ServicesPage() {
  const services = await db.service.findMany({
    where: { isActive: true, provider: { isEnabled: true }, category: { isActive: true } },
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }], take: 500,
  });
  return <main className="container catalog-page">
    <div className="catalog-heading"><div><div className="eyebrow">Katalog layanan</div><h1>Pilih layanan</h1><p className="muted">Bandingkan harga dan batas pesanan sebelum melanjutkan.</p></div><Link href="/dashboard/orders/new" className="btn btn-primary">Pesanan baru <ArrowRight size={15}/></Link></div>
    <ServicesCatalog services={services.map((service) => ({ id: service.id, name: service.name, category: service.category?.name ?? "Lainnya", description: service.description, sellingRate: service.sellingRate.toString(), minQuantity: service.minQuantity, maxQuantity: service.maxQuantity, refillSupported: service.refillSupported, cancelSupported: service.cancelSupported }))} />
    <p className="catalog-disclaimer">Harga dan ketersediaan mengikuti data provider yang aktif. Periksa detail layanan dan target sebelum mengonfirmasi pesanan.</p>
  </main>;
}
