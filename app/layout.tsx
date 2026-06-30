import type { Metadata } from "next";
import "../src/index.css";

export const metadata: Metadata = {
  title: "Empire Age",
  description: "Global Strategy MMO",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-amber-500/30 selection:text-amber-100 antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
