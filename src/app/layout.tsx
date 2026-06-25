import type { Metadata } from "next";
// Fontes empacotadas localmente (sem fetch ao Google Fonts no build).
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ToastProvider } from "./_app/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plataforma de IA — Indeba",
  description: "Plataforma de IA da Indeba: propostas, prospecção, posts e atendimento. Preço sempre do catálogo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
