import { NextRequest, NextResponse } from "next/server";
import { SolicitacaoComercialCreate, SolicitacaoComercialUpdate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import {
  criarSolicitacaoComercial,
  listarSolicitacoesComerciais,
  editarSolicitacaoComercial,
  excluirSolicitacaoComercial,
  restaurarSolicitacaoComercial,
  excluirSolicitacaoComercialDefinitivo,
} from "@/lib/ferramentas-comerciais";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Solicitações Comerciais (Ferramentas Comerciais): análise de água e/ou tecidos, visita
// do setor técnico, amostra para demonstrações. Gestor vê todas, vendedor vê as suas.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const excluidas = req.nextUrl.searchParams.get("excluidas") === "1";
  try {
    const solicitacoes = await listarSolicitacoesComerciais(usuario, excluidas);
    return NextResponse.json({ solicitacoes, souGestor: usuario.papel === "admin" });
  } catch (e) {
    return respostaErro(e, "Falha ao listar as solicitações.", 500);
  }
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = SolicitacaoComercialCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const solicitacao = await criarSolicitacaoComercial(usuario.email, parsed.data);
    return NextResponse.json(solicitacao, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao abrir a solicitação.", 500);
  }
}

// Edição (áudio do Mateus, 25/08/2026: o usuário edita as suas, exclusão é do gestor):
// status pendente ⇄ atendida, tipo, cliente e observação. Alheia responde 404.
// `?acao=restaurar` tira a solicitação da aba Excluídos — operação de gestor.
export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Solicitação não informada." }, { status: 400 });

  if (req.nextUrl.searchParams.get("acao") === "restaurar") {
    if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode restaurar solicitações." }, { status: 403 });
    try {
      const ok = await restaurarSolicitacaoComercial(usuario, id);
      if (!ok) return NextResponse.json({ erro: "Solicitação não encontrada." }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return respostaErro(e, "Falha ao restaurar a solicitação.", 500);
    }
  }

  const parsed = SolicitacaoComercialUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const ok = await editarSolicitacaoComercial(usuario, id, parsed.data);
    if (!ok) return NextResponse.json({ erro: "Solicitação não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao atualizar a solicitação.", 500);
  }
}

// Excluir é SÓ do gestor (áudio do Mateus, 25/08/2026: "eles não podem excluir as
// solicitações"). Sem `?definitivo=1` vira lápide; com, some de vez — e só de lá.
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode excluir solicitações." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Solicitação não informada." }, { status: 400 });
  const definitivo = req.nextUrl.searchParams.get("definitivo") === "1";
  try {
    const ok = definitivo ? await excluirSolicitacaoComercialDefinitivo(usuario, id) : await excluirSolicitacaoComercial(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Solicitação não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir a solicitação.", 500);
  }
}
