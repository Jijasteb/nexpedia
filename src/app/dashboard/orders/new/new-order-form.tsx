"use client";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, CircleDollarSign, ShieldCheck, ShoppingCart } from "lucide-react";
import { readJsonResponse } from "@/lib/client-api";

type Service = { id: string; name: string; sellingRate: string; minQuantity: number; maxQuantity: number };
const money=(value:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value);
export function NewOrderForm({ services, initialService }: { services: Service[]; initialService: string }) {
 const router=useRouter();
 const [serviceId,setServiceId]=useState(services.some(s=>s.id===initialService)?initialService:services[0]?.id??"");
 const [link,setLink]=useState(""); const [quantity,setQuantity]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [messageType,setMessageType]=useState<"error"|"success"|"info">("info");
 const idempotencyKey=useRef<string|null>(null); const service=services.find(s=>s.id===serviceId); const numericQuantity=Number(quantity);
 const validQuantity=Boolean(service&&quantity.trim()&&Number.isSafeInteger(numericQuantity)&&numericQuantity>=service.minQuantity&&numericQuantity<=service.maxQuantity);
 const estimate=useMemo(()=>service&&validQuantity?Math.ceil(Number(service.sellingRate)*numericQuantity/1000):0,[service,validQuantity,numericQuantity]);
 const validUrl=useMemo(()=>{try{const parsed=new URL(link);return parsed.protocol==="https:"||parsed.protocol==="http:";}catch{return false;}},[link]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setMessage("");
  if(!service){setMessageType("error");setMessage("Pilih layanan terlebih dahulu.");return;}
  if(!validUrl){setMessageType("error");setMessage("Masukkan URL target yang valid dan diawali http:// atau https://.");return;}
  if(!validQuantity){setMessageType("error");setMessage(`Jumlah harus antara ${service.minQuantity.toLocaleString("id-ID")} dan ${service.maxQuantity.toLocaleString("id-ID")} unit.`);return;}
  setBusy(true);
  try{if(!idempotencyKey.current)idempotencyKey.current=typeof crypto!=="undefined"&&"randomUUID"in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
   const response=await fetch("/api/orders",{method:"POST",headers:{"content-type":"application/json","idempotency-key":idempotencyKey.current},body:JSON.stringify({serviceId,link:link.trim(),quantity:numericQuantity})});
   const body=await readJsonResponse<{data?:unknown;error?:{message?:string}}>(response);
   if(!response.ok&&response.status!==202){if([400,401,402,404,422].includes(response.status))idempotencyKey.current=null;throw new Error(body?.error?.message??"Pesanan gagal dibuat.");}
   setMessageType(response.status===202?"info":"success");setMessage(body?.error?.message??(response.status===202?"Permintaan diterima, tetapi status pengiriman belum pasti. Periksa riwayat pesanan sebelum mencoba lagi.":"Pesanan tercatat. Kamu dapat memantau statusnya di riwayat pesanan."));
   if(response.status!==202){idempotencyKey.current=null;setLink("");setQuantity("");}
   router.refresh();
  }catch(error){setMessageType("error");setMessage(error instanceof Error?error.message:"Terjadi kesalahan. Coba lagi.");}
  finally{setBusy(false);}
 }
 if(!services.length)return <div className="panel order-form-empty"><div className="order-form-icon"><ShoppingCart size={22}/></div><h2>Belum ada layanan siap dipesan</h2><p>Provider atau katalog layanan belum aktif. Silakan cek kembali nanti atau hubungi admin jika masalah berlanjut.</p><a className="btn btn-quiet" href="/services">Kembali ke katalog</a></div>;
 return <div className="new-order-layout">
  <form className="panel new-order-form" onSubmit={submit} noValidate>
   <div className="new-order-form-heading"><span className="new-order-step">01</span><div><h2>Detail pesanan</h2><p>Pilih layanan dan masukkan informasi target.</p></div></div>
   <div className="new-order-field"><label htmlFor="order-service">Layanan</label><select id="order-service" required value={serviceId} onChange={e=>setServiceId(e.target.value)} className="field">{services.map(s=><option key={s.id} value={s.id}>{s.name} — {money(Number(s.sellingRate))}/1.000</option>)}</select><small>Harga dihitung per 1.000 unit, kecuali ditentukan lain oleh provider.</small></div>
   {service&&<div className="order-service-limits"><div><span>Minimum</span><strong>{service.minQuantity.toLocaleString("id-ID")}</strong></div><div><span>Maksimum</span><strong>{service.maxQuantity.toLocaleString("id-ID")}</strong></div><div><span>Harga / 1.000</span><strong>{money(Number(service.sellingRate))}</strong></div></div>}
   <div className="new-order-field"><label htmlFor="order-target">URL target</label><input id="order-target" className="field" required type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://instagram.com/…" value={link} onChange={e=>setLink(e.target.value)} maxLength={2048} aria-describedby="order-target-help"/><small id="order-target-help">Gunakan tautan konten atau profil yang sesuai dengan ketentuan layanan. Pastikan tautan dapat diakses.</small>{link&&!validUrl&&<small className="order-field-error">Masukkan URL lengkap dengan http:// atau https://.</small>}</div>
   <div className="new-order-field"><label htmlFor="order-quantity">Jumlah</label><input id="order-quantity" className="field" required type="number" inputMode="numeric" min={service?.minQuantity??1} max={service?.maxQuantity??10000000} step={1} value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder={`Contoh: ${service?.minQuantity??100}`}/><small>Masukkan bilangan bulat sesuai batas minimum dan maksimum.</small>{quantity&&!validQuantity&&<small className="order-field-error">Jumlah harus antara {service?.minQuantity.toLocaleString("id-ID")} dan {service?.maxQuantity.toLocaleString("id-ID")}.</small>}</div>
   <div className="order-cost-box"><div className="order-cost-label"><CircleDollarSign size={18}/><div><span>Estimasi biaya</span><small>Jumlah × harga layanan</small></div></div><strong>{money(estimate)}</strong></div>
   {message&&<div className={`order-feedback order-feedback-${messageType}`} role={messageType==="error"?"alert":"status"}>{messageType==="error"?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>}<span>{message}</span></div>}
   <button className="btn btn-primary new-order-submit" disabled={busy||!serviceId} type="submit">{busy?<><span className="spin-dot"/> Memproses pesanan…</>:<>Konfirmasi pesanan <ShoppingCart size={16}/></>}</button>
   <p className="order-form-footnote"><ShieldCheck size={14}/> Saldo diproses sesuai hasil pencatatan pesanan. Jika status pengiriman belum pasti, periksa riwayat pesanan dan jangan mengirim permintaan yang sama berulang kali.</p>
  </form>
  <aside className="order-side-note"><div className="order-side-icon"><ShieldCheck size={19}/></div><h2>Sebelum memesan</h2><ul><li>Periksa kembali layanan dan URL target.</li><li>Pastikan jumlah sesuai batas layanan.</li><li>Biaya yang terlihat adalah estimasi berdasarkan harga katalog.</li><li>Pesanan yang sudah diteruskan ke provider belum tentu bisa dibatalkan.</li></ul><div className="order-side-bottom"><strong>Butuh bantuan?</strong><p>Jika status tidak berubah atau saldo belum sesuai, hubungi tim dukungan dengan menyertakan referensi pesanan.</p><a href="/contact">Hubungi dukungan →</a></div></aside>
 </div>;
}
