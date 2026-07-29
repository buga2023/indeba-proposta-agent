import { NextRequest, NextResponse } from "next/server";
import { RagRequest } from "@/lib/contracts";
import { responder } from "@/lib/rag/responder";
import { indexarCatalogo, indexarDoc } from "@/lib/rag/indexar";
import { qdrantDisponivel } from "@/lib/rag/qdrant";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = RagRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  // Todas as ações dependem do vector DB. Sem ele, erro claro e acionável.
  if (!(await qdrantDisponivel())) {
    return NextResponse.json(
      { erro: "Qdrant indisponível. Suba com: docker compose up -d qdrant" },
      { status: 503 },
    );
  }

  try {
    const d = parsed.data;
    if (d.acao === "perguntar") return NextResponse.json(await responder(d.pergunta));
    if (d.acao === "indexar-catalogo") return NextResponse.json(await indexarCatalogo());
    return NextResponse.json(await indexarDoc(d.titulo, d.texto));
  } catch (e) {
    return respostaErro(e, "Falha no atendimento (RAG).", 500);
  }
}
