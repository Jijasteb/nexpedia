"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, LayoutDashboard, LogOut, Menu, PackagePlus, ShoppingBag, WalletCards, X, type LucideIcon } from "lucide-react";

type Props = { appName: string };
type NavItem = { href: string; label: string; icon: LucideIcon | null };

const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

export function SiteNavigation({ appName }: Props) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isAuth = authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isHome = pathname === "/";
  const isWorkspace = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isHome || isAuth) return null;

  const links: NavItem[] = isWorkspace
    ? [
        { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
        { href: "/dashboard/orders/new", label: "Pesanan baru", icon: PackagePlus },
        { href: "/dashboard/orders", label: "Pesanan", icon: ShoppingBag },
        { href: "/dashboard/deposits", label: "Deposit", icon: WalletCards },
        { href: "/services", label: "Layanan", icon: null },
        ...(pathname.startsWith("/admin") ? [{ href: "/admin", label: "Admin", icon: LayoutDashboard }, { href: "/admin/users", label: "Pengguna & saldo", icon: WalletCards }] : []),
      ]
    : [
        { href: "/services", label: "Layanan", icon: null },
        { href: "/contact", label: "Kontak", icon: null },
        { href: "/terms", label: "Ketentuan", icon: null },
      ];

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("logout_failed");
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="site-nav-wrap">
      <div className="site-nav container">
        <Link href={isWorkspace ? (pathname.startsWith("/admin") ? "/admin" : "/dashboard") : "/"} className="site-brand" aria-label={`${appName}, beranda`}>
          <Image src="/nexora-mark.svg" width={36} height={36} alt="" priority />
          <span>{appName}</span>
        </Link>
        <button className="site-nav-toggle" type="button" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Tutup menu" : "Buka menu"} aria-expanded={mobileOpen} aria-controls="primary-navigation">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav id="primary-navigation" className={`site-nav-links${mobileOpen ? " is-open" : ""}`} aria-label="Navigasi utama">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/services" && pathname.startsWith("/services/"));
            return <Link key={href} href={href} className={`site-nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}>{Icon && <Icon size={15} />}<span>{label}</span></Link>;
          })}
          {isWorkspace ? (
            <button type="button" className="site-nav-logout" onClick={logout} disabled={loggingOut}>{loggingOut ? <span className="spin-dot" /> : <LogOut size={15} />}<span>{loggingOut ? "Keluar…" : "Keluar"}</span></button>
          ) : (
            <div className="site-nav-actions"><Link className="btn btn-quiet" href="/login" onClick={() => setMobileOpen(false)}>Masuk</Link><Link className="btn btn-primary" href="/register" onClick={() => setMobileOpen(false)}>Buat akun <ArrowUpRight size={15} /></Link></div>
          )}
        </nav>
      </div>
    </header>
  );
}
