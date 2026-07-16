import { NextRequest, NextResponse } from "next/server";
import { validarSessao } from "@/lib/auth";

export const runtime = "nodejs";

// Usuário da sessão atual — a UI usa isto para personalizar saudação/sidebar
// (nome/papel vêm do cookie assinado, sem tocar banco).
export async function GET(req: NextRequest) {
  const usuario = await validarSessao(req.cookies.get("sessao")?.value);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  return NextResponse.json(usuario);
}
