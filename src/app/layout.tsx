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
      <head>
        {/* Fontes do design (carregadas em runtime, sem fetch ao Google Fonts no build). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: <link> no root layout vale para todas as rotas */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:wght@600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
