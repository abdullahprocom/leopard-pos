import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { StoreProvider } from "@/lib/store-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "APR System - منظومة الكاشير وإدارة المخازن المتكاملة",
  description: "منظومة APR System - نظام محاسبي متكامل للسوبر ماركت والمخازن العامة مع دعم العمل أوفلاين والمزامنة السحابية",
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
        <StoreProvider>
          {children}
          <Toaster position="top-center" richColors dir="rtl" />
        </StoreProvider>
      </body>
    </html>
  );
}
