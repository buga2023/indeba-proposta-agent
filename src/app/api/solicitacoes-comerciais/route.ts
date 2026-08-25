import { NextRequest, NextResponse } from "next/server";
import { SolicitacaoComercialCreate, SolicitacaoComercialUpdate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import {
  criarSolicitacaoComercial,
  listarSolicitacoesComerciais,
  atualizarStatusSolicitacao,
  excluirSolicitacaoComercial,
} from "@/lib/ferramentas-comerciais";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Solicitações Comerciais (Ferramentas Comerciais): análise de água e/ou tecidos, visita
// do setor técnico, amostra para demonstrações. Gestor vê todas, vendedor vê as suas.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    const solicitacoes = await listarSolicitacoesComerciais(usuario);
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

// Pendente ⇄ atendida. Escopo por autor (vendedor marca as suas; gestor, qualquer uma);
// alheia responde 404.
export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Solicitação não informada." }, { status: 400 });
  const parsed = SolicitacaoComercialUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const ok = await atualizarStatusSolicitacao(usuario, id, parsed.data.status);
    if (!ok) return NextResponse.json({ erro: "Solicitação não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao atualizar a solicitação.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Solicitação não informada." }, { status: 400 });
  try {
    const ok = await excluirSolicitacaoComercial(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Solicitação não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir a solicitação.", 500);
  }
}
