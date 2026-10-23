"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, ShoppingBag, ArrowUpRight } from "lucide-react";

type Order = { id: string; internalReference: string; serviceName: string; quantity: number; charge: string; status: string; targetUrl: string; createdAt: string };
const labels: Record<string,string> = { PENDING:"Menunggu", SUBMITTING:"Mengirim", SUBMISSION_UNKNOWN:"Perlu pemeriksaan", PROCESSING:"Diproses", IN_PROGRESS:"Berjalan", COMPLETED:"Selesai", PARTIAL:"Sebagian", CANCELED:"Dibatalkan", FAILED:"Gagal" };
const tone: Record<string,string> = { COMPLETED:"success", FAILED:"danger", CANCELED:"danger", PARTIAL:"warning", SUBMISSION_UNKNOWN:"warning", PENDING:"neutral", SUBMITTING:"neutral", PROCESSING:"info", IN_PROGRESS:"info" };
const money = (value:string) => new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value));
export function OrdersList({ orders }: { orders: Order[] }) {
 const [query,setQuery]=useState(""); const [filter,setFilter]=useState("ALL");
 const counts=useMemo(()=>orders.reduce<Record<string,number>>((acc,o)=>{acc[o.status]=(acc[o.status]??0)+1;return acc;},{}),[orders]);
 const filtered=useMemo(()=>orders.filter(o=>(filter==="ALL"||o.status===filter)&&`${o.internalReference} ${o.serviceName} ${o.targetUrl}`.toLowerCase().includes(query.trim().toLowerCase())),[orders,filter,query]);
 return <>
  <section className="orders-tools panel" aria-label="Cari dan filter pesanan">
   <label className="orders-search"><Search size={17}/><span className="sr-only">Cari pesanan</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari referensi, layanan, atau URL…" /></label>
   <label className="orders-filter">Status <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">Semua status ({orders.length})</option>{Object.entries(labels).filter(([key])=>counts[key]).map(([key,label])=><option key={key} value={key}>{label} ({counts[key]})</option>)}</select></label>
   <span className="orders-result-count">{filtered.length} pesanan</span>
  </section>
  {filtered.length ? <section className="orders-results panel"><div className="orders-table-scroll"><table className="orders-table"><thead><tr><th>Referensi / layanan</th><th>Jumlah</th><th>Biaya</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td><div className="orders-ref">{o.internalReference}</div><div className="orders-service">{o.serviceName}</div><a className="orders-target" href={o.targetUrl} target="_blank" rel="noreferrer">Lihat target <ArrowUpRight size={12}/></a></td><td>{o.quantity.toLocaleString("id-ID")}</td><td className="orders-money">{money(o.charge)}</td><td><span className={`order-status order-status-${tone[o.status]??"neutral"}`}>{labels[o.status]??o.status.replaceAll("_"," ")}</span>{o.status==="SUBMISSION_UNKNOWN"&&<div className="orders-warning">Jangan kirim ulang dulu.</div>}</td><td className="orders-date">{new Date(o.createdAt).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"})}</td></tr>)}</tbody></table></div>
  <div className="orders-mobile-list">{filtered.map(o=><article className="orders-mobile-card" key={o.id}><div className="orders-mobile-top"><span className="orders-ref">{o.internalReference}</span><span className={`order-status order-status-${tone[o.status]??"neutral"}`}>{labels[o.status]??o.status.replaceAll("_"," ")}</span></div><strong>{o.serviceName}</strong><div className="orders-mobile-meta"><span>{o.quantity.toLocaleString("id-ID")} unit</span><span>{money(o.charge)}</span></div><a className="orders-mobile-link" href={o.targetUrl} target="_blank" rel="noreferrer">Lihat target <ArrowUpRight size={14}/></a><small>{new Date(o.createdAt).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"})}</small>{o.status==="SUBMISSION_UNKNOWN"&&<p className="orders-warning">Status provider belum pasti. Jangan buat pesanan ulang sebelum diperiksa.</p>}</article>)}</div></section> : <div className="panel orders-empty"><div className="orders-empty-icon"><ShoppingBag size={22}/></div><h2>{orders.length?"Tidak ada hasil":"Belum ada pesanan"}</h2><p>{orders.length?"Coba ubah kata kunci atau filter status.":"Pesanan yang kamu buat akan muncul di halaman ini."}</p>{orders.length?<button className="btn btn-quiet" onClick={()=>{setQuery("");setFilter("ALL");}}>Reset filter</button>:<Link className="btn btn-primary" href="/services">Jelajahi layanan</Link>}</div>}
 </>;
}
