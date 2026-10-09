import { NextRequest, NextResponse } from "next/server";
import { bloqueioDeFerramenta } from "@/lib/plano";
import { ContratoRequest } from "@/lib/contracts";
import { gerarContrato } from "@/lib/contrato/gerar";
import { analisarContrato } from "@/lib/contrato/analisar";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Plano de ferramentas (lib/plano.ts): 403 se esta ferramenta não está habilitada.
  const bloqueio = await bloqueioDeFerramenta("gerador-contratos");
  if (bloqueio) return bloqueio;
  const parsed = ContratoRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.acao === "gerar") {
      return NextResponse.json(await gerarContrato(parsed.data.proposta));
    }
    return NextResponse.json(await analisarContrato(parsed.data.texto));
  } catch (e) {
    return respostaErro(e, "Falha ao processar o contrato.", 500);
  }
}
