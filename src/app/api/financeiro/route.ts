import { NextRequest, NextResponse } from "next/server";
import { FinanceiroRequest } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import { perguntar, IaIndisponivelError } from "@/lib/financeiro/agente";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

// Só o gestor. O agente responde sobre as planilhas financeiras da empresa (faturamento,
// margens, fluxo) — o mesmo tipo de dado que `/api/cobranca` já trancou para admin com a
// justificativa de tirar da vista do vendedor. O middleware exige login; falta o gate de
// PAPEL, senão qualquer vendedor logado consulta as finanças da empresa.
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") {
    return NextResponse.json({ erro: "Só o gestor acessa o agente financeiro." }, { status: 403 });
  }

  const parsed = FinanceiroRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const res = await perguntar(parsed.data);
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof IaIndisponivelError) {
      return NextResponse.json({ erro: e.message }, { status: 503 });
    }
    return respostaErro(e, "Falha ao processar a pergunta.", 500);
  }
}
