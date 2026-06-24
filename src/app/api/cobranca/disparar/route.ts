import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/chamados";
import { dispararCobranca } from "@/lib/contatos";

export const runtime = "nodejs";
export const maxDuration = 30;

// Dispara o webhook do n8n: e-mail de cobrança a cada cliente + resumo ao gestor.
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = (await req.json()) as { inadimplentes?: unknown[]; totalDevido?: string };
  if (!Array.isArray(body.inadimplentes) || !body.inadimplentes.length) {
    return NextResponse.json({ erro: "Nada para cobrar." }, { status: 400 });
  }
  try {
    const r = await dispararCobranca(body.inadimplentes, body.totalDevido ?? "0.00");
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao disparar a cobrança." },
      { status: 502 },
    );
  }
}
