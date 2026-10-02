import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "UP 2 Hand — ตลาดมือสอง ม.พะเยา",
  description: "ซื้อขายและส่งต่อของมือสองสำหรับนิสิตและบุคลากร มหาวิทยาลัยพะเยา",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[#faf9f7] text-stone-900 antialiased">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16">{children}</main>
        <footer className="border-t bg-white py-6 text-center text-xs text-stone-500">
          UP 2 Hand · สาขาวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยพะเยา · Phase A (MVP)
        </footer>
      </body>
    </html>
  );
}
