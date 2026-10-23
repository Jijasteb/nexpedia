import Image from "next/image";
import Link from "next/link";
import { getAppName } from "@/lib/app-config";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ShieldCheck, WalletCards, Zap } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Status yang jelas", text: "Lihat status order dan catatan aktivitas tanpa menebak-nebak apa yang sedang terjadi." },
  { icon: Zap, title: "Alur pemesanan ringkas", text: "Pilih layanan, masukkan target, cek estimasi, lalu pantau progres dari satu tempat." },
  { icon: WalletCards, title: "Riwayat saldo terpusat", text: "Pantau deposit dan perubahan saldo dengan catatan transaksi yang mudah ditelusuri." },
];

const steps = [
  { n: "01", title: "Buat akun", text: "Daftar dengan alamat Gmail yang lolos pemeriksaan kelayakan email." },
  { n: "02", title: "Pilih layanan", text: "Periksa harga, batas jumlah, dan detail layanan sebelum mengirim pesanan." },
  { n: "03", title: "Kelola aktivitas", text: "Lakukan deposit dan pantau status transaksi dari dashboard NEXORA." },
];

const faqs = [
  { q: "Bagaimana email diperiksa saat daftar?", a: "NEXORA menggunakan Kickbox untuk memeriksa kelayakan alamat Gmail menerima email. Pemeriksaan ini bukan proses login Google dan tidak membuktikan kepemilikan inbox." },
  { q: "Kapan saldo deposit bertambah?", a: "Saldo hanya boleh bertambah setelah pembayaran diverifikasi melalui webhook pembayaran yang sah. Jika status belum pasti, periksa riwayat deposit dan jangan membuat permintaan berulang." },
  { q: "Apa yang harus dilakukan jika lupa password?", a: "Gunakan tautan Lupa password di halaman masuk untuk menghubungi admin melalui Telegram resmi yang dikonfigurasi pemilik panel." },
  { q: "Apakah semua layanan langsung tersedia?", a: "Layanan ditampilkan setelah provider diaktifkan dan katalog disinkronkan oleh admin. Ketersediaan dan status provider dapat berubah." },
];

export default function Home() {
  const appName = getAppName();
  return (
    <main className="landing-page">
      <header className="landing-header container">
        <Link href="/" className="landing-brand"><Image src="/nexora-mark.svg" width={40} height={40} alt="" priority /><span>{appName}</span></Link>
        <nav className="landing-nav" aria-label="Navigasi landing page"><a href="#platform">Platform</a><a href="#how">Cara kerja</a><a href="#faq">FAQ</a></nav>
        <div className="landing-actions"><Link href="/login" className="btn btn-quiet">Masuk</Link><Link href="/register" className="btn btn-primary">Buat akun <ArrowUpRight size={16} /></Link></div>
      </header>

      <section className="landing-hero container">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="status-pulse" /> WORKSPACE SOCIAL GROWTH</div>
          <h1>Semua aktivitas sosial, <span>dikelola lebih jelas.</span></h1>
          <p className="hero-description">Temukan layanan, buat pesanan, dan pantau saldo dalam satu panel yang dirancang agar setiap langkah terasa sederhana.</p>
          <div className="hero-actions"><Link className="btn btn-primary btn-large" href="/register">Mulai sekarang <ArrowRight size={17} /></Link><Link className="btn btn-quiet btn-large" href="/services">Jelajahi layanan</Link></div>
          <div className="hero-assurances"><span><Check size={15} /> Riwayat aktivitas</span><span><Check size={15} /> Status pesanan</span><span><Check size={15} /> Kontrol saldo</span></div>
        </div>


      </section>

      <section id="platform" className="landing-features">
        <div className="container"><div className="section-heading"><span className="section-eyebrow">Dibuat untuk alur harian</span><h2>Lebih sedikit friksi.<br /><span>Lebih banyak kendali.</span></h2><p>Fokus pada hal penting dengan navigasi yang rapi, detail layanan yang terbaca, dan aktivitas yang mudah ditemukan.</p></div>
          <div className="feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article className="feature-card" key={title}><div className="feature-card-top"><span className="feature-icon"><Icon size={20} /></span><span className="feature-index">{String(index + 1).padStart(2, "0")}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section id="how" className="landing-steps container"><div className="section-heading"><span className="section-eyebrow">Cara kerja</span><h2>Mulai dengan alur<br /><span>yang mudah diikuti.</span></h2><p>Setiap langkah memberi konteks agar Anda tahu apa yang perlu dilakukan berikutnya.</p></div><div className="steps-grid">{steps.map((step) => <article className="step-card" key={step.n}><span className="step-number">{step.n}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>

      <section id="faq" className="landing-faq"><div className="container faq-layout"><div className="section-heading"><span className="section-eyebrow">Pertanyaan umum</span><h2>Hal penting,<br /><span>dijelaskan singkat.</span></h2><p>Belum menemukan jawaban? Hubungi admin melalui halaman kontak.</p><Link href="/contact" className="faq-contact">Hubungi kami <ArrowRight size={15} /></Link></div><div className="faq-list">{faqs.map((faq) => <details className="faq-item" key={faq.q}><summary>{faq.q}<ChevronDown size={18} /></summary><p>{faq.a}</p></details>)}</div></div></section>

      <section className="landing-cta"><div className="container cta-inner"><div><span className="section-eyebrow">Workspace Anda dimulai di sini</span><h2>Siap mengelola aktivitas<br />dengan lebih terarah?</h2><p>Buat akun untuk mengakses dashboard dan katalog layanan.</p></div><Link href="/register" className="btn btn-light btn-large">Buat akun NEXORA <ArrowRight size={17} /></Link></div></section>

      <footer className="landing-footer container"><Link href="/" className="footer-brand"><Image src="/nexora-mark.svg" width={30} height={30} alt="" /><span>{appName}</span></Link><span>© {new Date().getFullYear()} {appName}. Semua hak dilindungi.</span><nav aria-label="Tautan legal"><Link href="/terms">Ketentuan</Link><Link href="/privacy">Privasi</Link><Link href="/contact">Kontak</Link></nav></footer>
    </main>
  );
}
