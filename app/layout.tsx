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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f59e0b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/logo.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('ServiceWorker registered successfully with scope: ', reg.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-amber-500/30 selection:text-amber-100 antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
