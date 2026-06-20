import { NextRequest, NextResponse } from "next/server";
import { PropostaScope } from "@/lib/contracts";
import { renderPdf } from "@/lib/pdf/render";
import { validarSessao } from "@/lib/auth";
import { eventoDe, registrarProposta } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 60; // render do Chromium serverless (Vercel)

// PropostaScope (revisado na tela) → PDF. Mesmo objeto que a tela mostra vira PDF.
export async function POST(req: NextRequest) {
  const parsed = PropostaScope.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  const pdf = await renderPdf(parsed.data);

  // Log append-only (§1.8): quem gerou, cliente, itens e preços. Best-effort —
  // falha de log nunca derruba a entrega do PDF.
  try {
    const usuario = (await validarSessao(req.cookies.get("sessao")?.value))?.login ?? "local";
    await registrarProposta(eventoDe(parsed.data, usuario));
  } catch (e) {
    console.error("falha ao registrar log da proposta:", e);
  }

  // Content-Disposition é ByteString (Latin-1): nome com char >255 (travessão,
  // emoji, etc.) lança ao serializar o header. Filename ASCII como fallback +
  // filename* (RFC 5987) com o nome real em UTF-8 para navegadores modernos.
  const nome = parsed.data.cliente.razaoSocial;
  const ascii =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // remove acentos
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cliente";
  const utf8 = encodeURIComponent(`proposta-${nome}.pdf`);

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proposta-${ascii}.pdf"; filename*=UTF-8''${utf8}`,
    },
  });
}
