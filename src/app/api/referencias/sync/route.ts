import { NextRequest, NextResponse } from "next/server";
import { SyncReferenciasRequest } from "@/lib/contracts";
import { analisarReferencias, salvarPerfilEstilo, carregarPerfilEstilo } from "@/lib/referencias/analisar";

export const runtime = "nodejs";
export const maxDuration = 300; // visão por imagem + síntese: bem mais lento que um post

// Recebe os posts de referência (do n8n/Drive), deriva o perfil de estilo e o salva.
export async function POST(req: NextRequest) {
  const parsed = SyncReferenciasRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const perfil = await analisarReferencias(parsed.data.itens);
    await salvarPerfilEstilo(perfil);
    return NextResponse.json(perfil);
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao analisar as referências." },
      { status: 500 },
    );
  }
}

// Inspeciona o perfil de estilo atual (ou 404 se ainda não há nenhum).
export async function GET() {
  const perfil = await carregarPerfilEstilo();
  if (!perfil) return NextResponse.json({ erro: "Nenhum perfil de estilo." }, { status: 404 });
  return NextResponse.json(perfil);
}
