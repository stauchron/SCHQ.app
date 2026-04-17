import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Staudt Chronometrie — Testadministratie",
  description: "Mechanische horloge-tests administreren.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#062035",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-white text-black">
        <Header />
        <main className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
