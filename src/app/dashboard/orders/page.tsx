import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OrdersList } from "./orders-list";

export const dynamic = "force-dynamic";
export default async function OrdersPage() {
 const user=await getSessionUser();
 if(!user) redirect("/login?next=/dashboard/orders");
 const orders=await db.order.findMany({where:{userId:user.id},include:{service:{select:{name:true}}},orderBy:{createdAt:"desc"},take:200});
 const active=orders.filter(o=>["PENDING","SUBMITTING","SUBMISSION_UNKNOWN","PROCESSING","IN_PROGRESS"].includes(o.status)).length;
 const completed=orders.filter(o=>o.status==="COMPLETED").length;
 const needsAttention=orders.filter(o=>["SUBMISSION_UNKNOWN","FAILED"].includes(o.status)).length;
 return <main className="container orders-page">
  <header className="orders-heading"><div><div className="eyebrow">Ruang pelanggan</div><h1>Pesanan Anda</h1><p>Pantau status, jumlah, dan biaya pesanan dalam satu tempat.</p></div><Link className="btn btn-primary" href="/dashboard/orders/new">Pesanan baru <ArrowRight size={16}/></Link></header>
  <section className="orders-summary" aria-label="Ringkasan pesanan"><article className="panel"><span className="orders-summary-label"><ClipboardList size={15}/> Total pesanan</span><strong>{orders.length.toLocaleString("id-ID")}</strong><small>Pesanan terbaru tercatat</small></article><article className="panel"><span className="orders-summary-label">Sedang berjalan</span><strong>{active.toLocaleString("id-ID")}</strong><small>Menunggu atau diproses provider</small></article><article className="panel"><span className="orders-summary-label">Selesai</span><strong>{completed.toLocaleString("id-ID")}</strong><small>Pesanan berstatus selesai</small></article><article className={`panel ${needsAttention?"orders-summary-alert":""}`}><span className="orders-summary-label">Perlu diperiksa</span><strong>{needsAttention.toLocaleString("id-ID")}</strong><small>{needsAttention?"Periksa status sebelum membuat ulang":"Tidak ada status yang perlu diperiksa"}</small></article></section>
  <OrdersList orders={orders.map(o=>({id:o.id,internalReference:o.internalReference,serviceName:o.service.name,quantity:o.quantity,charge:o.charge.toString(),status:o.status,targetUrl:o.targetUrl,createdAt:o.createdAt.toISOString()}))}/>
 </main>;
}
