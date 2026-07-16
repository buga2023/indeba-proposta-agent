import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validarSessao } from "@/lib/auth";
import { listarColaboradores, atualizarColaborador } from "@/lib/auth-db";

export const runtime = "nodejs";

// Lista/edita colaboradores (painel de admin) — só o gestor. Mesmo padrão de
// autorização de /api/contatos.
async function exigirGestor(req: NextRequest) {
  const sessao = await validarSessao(req.cookies.get("sessao")?.value);
  if (!sessao) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (sessao.papel !== "admin") return { erro: NextResponse.json({ erro: "Só o gestor acessa o cadastro." }, { status: 403 }) };
  return { erro: null };
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
});

export async function PATCH(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const { email, ...dados } = parsed.data;
  const colaborador = await atualizarColaborador(email, {
    ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
    ...(dados.telefone !== undefined ? { telefone: dados.telefone?.trim() || null } : {}),
  });
  return NextResponse.json(colaborador);
}
