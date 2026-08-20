import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leopard POS - نظام الكاشير والمخازن",
  description: "نظام كاشير ومخازن متكامل للسوبر ماركت - يعمل أونلاين وأوفلاين",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#090d16",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100">
        {children}
        <Toaster position="top-center" richColors dir="rtl" />
      </body>
    </html>
  );
}
