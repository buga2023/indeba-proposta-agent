import { NextRequest, NextResponse } from "next/server";
import { authAtiva, validarSessao } from "@/lib/auth";
import { acessoDe } from "@/lib/auth-db";

export const runtime = "nodejs";

// Usuário da sessão atual — a UI usa isto para personalizar saudação/sidebar
// (nome/papel vêm do cookie assinado, sem tocar banco).
export async function GET(req: NextRequest) {
  const usuario = await validarSessao(req.cookies.get("sessao")?.value);

  // Dev local (AUTH_ENABLED=false): não há cookie para validar, e o middleware já deixa
  // passar. Sem este ramo o 401 daqui manda a tela para /login — e como não há login em
  // modo local, o app fica inalcançável na própria máquina.
  if (!usuario && !authAtiva()) {
    return NextResponse.json({ email: "local", nome: "Local", papel: "admin" });
  }
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  // O cookie é autocontido e vale 8h sem tocar o banco — ótimo para não consultar Postgres
  // a cada request, ruim na hora de TIRAR acesso: revogar no painel não derrubaria quem já
  // está logado, e a pessoa seguiria usando o sistema até a sessão expirar. Esta é a única
  // consulta, uma por carregamento do app, e é ela que fecha a janela — quem perdeu o
  // acesso cai no login na próxima navegação, com o cookie já apagado.
  if ((await acessoDe(usuario.email)) !== "aprovado") {
    const res = NextResponse.json({ erro: "Acesso não liberado." }, { status: 401 });
    res.cookies.delete("sessao");
    return res;
  }
  return NextResponse.json(usuario);
}
