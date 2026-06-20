import type { Metadata } from "next";
// Fontes empacotadas localmente (sem fetch ao Google Fonts no build).
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agente de Proposta — Indeba Express",
  description: "Gere propostas comerciais em PDF a partir de um briefing. Preço sempre do catálogo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
