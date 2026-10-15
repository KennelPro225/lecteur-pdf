import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folio — Lisez partout, reprenez où vous vous êtes arrêté",
  description: "Lecteur PDF synchronisé entre tous vos appareils.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf8f3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-paper text-ink font-sans">{children}</body>
    </html>
  );
}
