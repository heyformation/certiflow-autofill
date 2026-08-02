import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CertiFlow AutoFill — Proforma & Proskills Institut",
  description: "Automated Document Fill-In Tool for Certification Files (CréActifs RS6485, RS7200, RS7311, RS7344)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
