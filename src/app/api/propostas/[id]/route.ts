import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { StatusUpdate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import { obterProposta, autorDaProposta, autorEStatusDaProposta, atualizarStatusProposta, excluirPropostaDefinitivamente } from "@/lib/propostas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Função, não constante: o corpo de um NextResponse é um stream de uso único — reaproveitar
// a mesma instância entre requisições devolveria resposta vazia a partir da segunda.
const naoEncontrada = () => NextResponse.json({ erro: "Proposta não encontrada." }, { status: 404 });

// Escopar só a listagem seria fachada: bastava trocar o id na URL para ler a proposta de um
// colega. Aqui o dono é conferido antes de devolver qualquer coisa.
//
// 404 e não 403: 403 confirma que a proposta EXISTE, e "existe uma proposta com esse id que
// não é sua" já é informação sobre a carteira alheia. Para quem não é dono, ela não existe.
//
// Sem sessão NEGA. O middleware já barra `/api/*` sem cookie válido, então na prática não
// se chega aqui sem usuário — mas o default de um gate não pode ser "libera": bastaria a
// rota sair do matcher do middleware para o portão virar decoração. Em dev local
// (AUTH_ENABLED=false) `usuarioAtual` devolve admin, então nada trava na máquina.
async function negar(req: NextRequest, autorDaProposta: string): Promise<boolean> {
  const usuario = await usuarioAtual(req);
  if (!usuario) return true;
  return usuario.papel !== "admin" && autorDaProposta !== usuario.email;
}

// Carrega a proposta completa (com o scope) — para reabrir/editar ou gerar contrato
// de uma proposta que já existe.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const registro = await obterProposta(id);
    if (!registro) return naoEncontrada();
    if (await negar(req, registro.autor)) return naoEncontrada();
    return NextResponse.json(registro);
  } catch (e) {
    return respostaErro(e, "Falha ao carregar a proposta", 500);
  }
}

// Muda o status comercial (enviada/aprovada/recusada/...). Só o status é mutável aqui;
// preço e itens vêm sempre do scope (constituição §2).
//
// Ação de GESTÃO: mudar status (inclusive "arquivada" = excluir e o restaurar) é só do
// admin. O vendedor edita a própria proposta pelo POST /api/propostas (o conteúdo), mas o
// status comercial e a exclusão são decisões do gestor — pedido do Gustavo, 17/08/2026.
// Para o dono não-admin a proposta EXISTE (ele a vê no GET), então aqui é 403, não 404.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = StatusUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    // Aqui só o dono importa — a proposta inteira seria carregada e jogada fora.
    const autor = await autorDaProposta(id);
    if (!autor) return naoEncontrada();
    if (await negar(req, autor)) return naoEncontrada();
    const usuario = await usuarioAtual(req);
    if (usuario?.papel !== "admin") {
      return NextResponse.json({ erro: "Apenas o administrador pode alterar o status ou excluir." }, { status: 403 });
    }
    return NextResponse.json(await atualizarStatusProposta(id, parsed.data.status));
  } catch (e) {
    // Só o "registro não encontrado" (P2025) é 404 — a autoria já foi conferida acima, então
    // uma falha aqui costuma ser transitória (banco fora do ar). Mapear TUDO para 404 dizia
    // "proposta não encontrada" no meio de um outage, escondendo o problema real.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return naoEncontrada();
    return respostaErro(e, "Falha ao atualizar o status", 500);
  }
}

// Exclusão DEFINITIVA — só o admin, e só de proposta já excluída (status "arquivada").
// É a limpeza da aba "Excluídas": daqui a proposta some do banco, sem volta. Exigir a
// arquivagem antes é o freio de duas etapas: ninguém apaga direto uma proposta ativa.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const registro = await autorEStatusDaProposta(id);
    if (!registro) return naoEncontrada();
    const usuario = await usuarioAtual(req);
    if (!usuario) return naoEncontrada();
    if (usuario.papel !== "admin") {
      // Não-admin nem descobre se o id existe fora da própria carteira.
      if (registro.autor !== usuario.email) return naoEncontrada();
      return NextResponse.json({ erro: "Apenas o administrador pode excluir definitivamente." }, { status: 403 });
    }
    if (registro.status !== "arquivada") {
      return NextResponse.json({ erro: "Só propostas já excluídas (aba Excluídas) podem ser apagadas definitivamente." }, { status: 409 });
    }
    await excluirPropostaDefinitivamente(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return naoEncontrada();
    return respostaErro(e, "Falha ao excluir a proposta", 500);
  }
}
