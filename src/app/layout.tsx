import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SyncBoot } from "@/components/SyncBoot";

// Be Vietnam Pro phủ đủ dấu tiếng Việt, kể cả các tổ hợp Geist còn thiếu.
const sans = Be_Vietnam_Pro({
  variable: "--font-geist-sans",
  weight: ["400", "500", "700", "900"],
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Make Your Move — Quản lý điểm",
  description:
    "Hệ thống quản lý Energy, Booster và đấu giá cho gameshow Make Your Move.",
};

export const viewport: Viewport = {
  themeColor: "#05070f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Extension trình duyệt (Grammarly, Dark Reader…) chèn thuộc tính vào
    // html/body trước khi React hydrate — bỏ qua cảnh báo lệch do chúng gây ra.
    <html lang="vi" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${sans.variable} ${geistMono.variable} antialiased`}
      >
        <SyncBoot />
        {children}
      </body>
    </html>
  );
}
