import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { criarUsuario, EmailEmUsoError } from "@/lib/auth-db";
import { criarSessao } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  senha: z.string().min(8).max(200),
});

// Cadastro próprio (self-service): o colaborador cria a conta com nome/e-mail/senha.
// Sucesso já loga direto (mesma sessão do /api/login) — sem passo extra.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  let usuario;
  try {
    usuario = await criarUsuario(parsed.data.nome, parsed.data.email, parsed.data.senha);
  } catch (e) {
    if (e instanceof EmailEmUsoError) return NextResponse.json({ erro: e.message }, { status: 409 });
    throw e;
  }

  const res = NextResponse.json({ ok: true, papel: usuario.papel }, { status: 201 });
  res.cookies.set("sessao", await criarSessao(usuario), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });
  return res;
}
