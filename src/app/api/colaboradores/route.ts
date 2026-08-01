import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validarSessao } from "@/lib/auth";
import { listarColaboradores, atualizarColaborador } from "@/lib/auth-db";

export const runtime = "nodejs";

// Lista/edita colaboradores (painel de admin) — só o gestor. Mesmo padrão de
// autorização de /api/contatos.
async function exigirGestor(req: NextRequest) {
  const sessao = await validarSessao(req.cookies.get("sessao")?.value);
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

  const colaborador = await atualizarColaborador(email, {
    ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
    ...(dados.telefone !== undefined ? { telefone: dados.telefone?.trim() || null } : {}),
    ...(dados.papel !== undefined ? { papel: dados.papel } : {}),
    ...(dados.acesso !== undefined ? { acesso: dados.acesso } : {}),
  });
  return NextResponse.json(colaborador);
}
