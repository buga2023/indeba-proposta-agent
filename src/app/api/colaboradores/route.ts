import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { usuarioAtual } from "@/lib/auth-db";
import { listarColaboradores, atualizarColaborador } from "@/lib/auth-db";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Lista/edita colaboradores (painel de admin) — só o gestor. Mesmo padrão de
// autorização de /api/contatos.
// `usuarioAtual` (auth-db) e não `validarSessao`: o papel vem do BANCO, não do cookie. Com
// o cookie, quem acabou de ser promovido continuaria levando 403 aqui até sair e entrar de
// novo — e é justamente este o painel onde a promoção acontece.
async function exigirGestor(req: NextRequest) {
  const sessao = await usuarioAtual(req);
  if (!sessao) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }), sessao: null };
  if (sessao.papel !== "admin") return { erro: NextResponse.json({ erro: "Só o gestor acessa o cadastro." }, { status: 403 }), sessao: null };
  return { erro: null, sessao };
}

export async function GET(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;
  return NextResponse.json({ colaboradores: await listarColaboradores() });
}

const Body = z.object({
  email: z.string().trim().email(),
  nome: z.string().trim().min(2).max(120).optional(),
  telefone: z.string().trim().max(20).nullable().optional(),
  papel: z.enum(["admin", "user"]).optional(),
  acesso: z.enum(["pendente", "aprovado", "bloqueado"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const { erro, sessao } = await exigirGestor(req);
  if (erro) return erro;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const { email, ...dados } = parsed.data;

  // O gestor não mexe no PRÓPRIO acesso nem no próprio papel. Sem esta trava, um clique
  // errado na própria linha revoga ou rebaixa quem controla o painel — e aí não sobra
  // ninguém com poder de desfazer, porque só o admin chega aqui. É recuperável apenas por
  // acesso direto ao banco, o que não pode ser o plano de recuperação de um clique.
  if (sessao && email.toLowerCase() === sessao.email.toLowerCase()) {
    if (dados.acesso !== undefined || dados.papel !== undefined) {
      return NextResponse.json(
        { erro: "Você não pode alterar o próprio acesso ou papel. Peça a outro gestor." },
        { status: 409 },
      );
    }
  }

  try {
    const colaborador = await atualizarColaborador(email, {
      ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
      ...(dados.telefone !== undefined ? { telefone: dados.telefone?.trim() || null } : {}),
      ...(dados.papel !== undefined ? { papel: dados.papel } : {}),
      ...(dados.acesso !== undefined ? { acesso: dados.acesso } : {}),
    });
    return NextResponse.json(colaborador);
  } catch (e) {
    // e-mail inexistente (colaborador removido, digitação) → P2025. Sem este catch a rota
    // devolvia 500 opaco; é a única rota de admin sem o wrapper de erro das irmãs.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ erro: "Colaborador não encontrado." }, { status: 404 });
    }
    return respostaErro(e, "Falha ao atualizar o colaborador.", 500);
  }
}
