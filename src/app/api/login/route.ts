import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AcessoPendenteError, validarCredenciais } from "@/lib/auth-db";
import { criarSessao } from "@/lib/auth";
import { registrarAcesso } from "@/lib/acessos";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email().max(200), senha: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  let usuario;
  try {
    usuario = await validarCredenciais(parsed.data.email, parsed.data.senha);
  } catch (e) {
    // Credencial certa, liberação faltando. 403 e não 401: o problema não é quem a pessoa
    // é, é o que ela ainda não pode. Nenhuma sessão é criada — sem aprovação do gestor,
    // nada do sistema é servido.
    if (e instanceof AcessoPendenteError) {
      await registrarAcesso(req, parsed.data.email, "recusado", e.acesso);
      return NextResponse.json({ erro: e.message, acesso: e.acesso }, { status: 403 });
    }
    throw e;
  }
  if (!usuario) {
    await registrarAcesso(req, parsed.data.email, "recusado", "senha_invalida");
    return NextResponse.json({ erro: "E-mail ou senha inválidos." }, { status: 401 });
  }

  // Trilha de acesso (áudio do Mateus, 10/09/2026): quem entrou, quando e de onde — é o
  // que o painel "Últimos acessos" lê. Nunca derruba o login (ver lib/acessos.ts).
  await registrarAcesso(req, usuario.email, "entrou");

  const res = NextResponse.json({ ok: true, papel: usuario.papel });
  res.cookies.set("sessao", await criarSessao(usuario), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });
  return res;
}
