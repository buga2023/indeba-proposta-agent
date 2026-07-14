import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validarCredenciais } from "@/lib/auth-db";
import { criarSessao } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email().max(200), senha: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const usuario = await validarCredenciais(parsed.data.email, parsed.data.senha);
  if (!usuario) return NextResponse.json({ erro: "E-mail ou senha inválidos." }, { status: 401 });

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
