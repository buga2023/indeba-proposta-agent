import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validarSessao } from "@/lib/auth";
import { buscarColaborador, atualizarColaborador } from "@/lib/auth-db";

export const runtime = "nodejs";

// Perfil do próprio colaborador (nome/telefone) — qualquer sessão válida, sem exigir admin.
// E-mail/senha/papel não são editáveis aqui (mudam via login/cadastro, não via perfil).
const Body = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  telefone: z.string().trim().max(20).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const sessao = await validarSessao(req.cookies.get("sessao")?.value);
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const colaborador = await buscarColaborador(sessao.email);
  if (!colaborador) return NextResponse.json({ erro: "Conta não encontrada." }, { status: 404 });
  return NextResponse.json(colaborador);
}

export async function PATCH(req: NextRequest) {
  const sessao = await validarSessao(req.cookies.get("sessao")?.value);
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const colaborador = await atualizarColaborador(sessao.email, {
    ...(parsed.data.nome !== undefined ? { nome: parsed.data.nome } : {}),
    ...(parsed.data.telefone !== undefined ? { telefone: parsed.data.telefone?.trim() || null } : {}),
  });
  return NextResponse.json(colaborador);
}
