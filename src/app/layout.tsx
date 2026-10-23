import type { Metadata } from "next";
import "./globals.css";
import { getAppName } from "@/lib/app-config";
import { SiteNavigation } from "@/components/site-navigation";
export const metadata: Metadata = { title: { default: getAppName(), template: `%s | ${getAppName()}` }, description: `Panel layanan social media marketing dari ${getAppName()}.`, icons: { icon: "/nexora-mark.svg", shortcut: "/nexora-mark.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const appName = getAppName(); return <html lang="id"><body><SiteNavigation appName={appName} />{children}</body></html>; }
