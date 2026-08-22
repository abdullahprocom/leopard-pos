import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { Toaster } from "sonner";
import { StoreProvider } from "@/lib/store-context";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ERP System - منظومة الكاشير وإدارة المخازن المتكاملة",
  description: "منظومة ERP المحاسبية - نظام محاسبي متكامل مع دعم العمل أوفلاين والمزامنة السحابية",
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
    <html lang="ar" dir="rtl" className={`dark h-full antialiased ${cairo.variable}`}>
      <body className={`min-h-full flex flex-col font-sans ${cairo.className} bg-slate-950 text-slate-100`}>
        <StoreProvider>
          {children}
          <Toaster position="top-center" richColors dir="rtl" />
        </StoreProvider>
      </body>
    </html>
  );
}
