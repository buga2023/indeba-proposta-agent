import { NextRequest, NextResponse } from "next/server";
import { StatusUpdate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth";
import { obterProposta, autorDaProposta, atualizarStatusProposta } from "@/lib/propostas";
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
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = StatusUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    // Aqui só o dono importa — a proposta inteira seria carregada e jogada fora.
    const autor = await autorDaProposta(id);
    if (!autor) return naoEncontrada();
    if (await negar(req, autor)) return naoEncontrada();
    return NextResponse.json(await atualizarStatusProposta(id, parsed.data.status));
  } catch (e) {
    // update num id inexistente → Prisma lança; tratamos como 404.
    return respostaErro(e, "Falha ao atualizar o status", 404);
  }
}
