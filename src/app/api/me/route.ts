import { NextRequest, NextResponse } from "next/server";
import { authAtiva, validarSessao } from "@/lib/auth";
import { estadoDaConta } from "@/lib/auth-db";

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
  // a cada request, ruim quando o poder da pessoa MUDA no meio da sessão. Uma consulta por
  // carregamento resolve as duas pontas:
  //
  //  - acesso revogado derruba na hora, em vez de valer até a sessão expirar;
  //  - o PAPEL sai do banco, não do que o cookie carimbou no login. Sem isso, promover
  //    alguém no painel (ou entrar em ADMIN_EMAILS) só surtia efeito depois de sair e
  //    entrar de novo — e como sem ser gestor a pessoa não vê o painel nem o botão de
  //    cadastrar produto, o sintoma era "não funciona", sem pista do que fazer.
  const estado = await estadoDaConta(usuario.email);
  if (!estado || estado.acesso !== "aprovado") {
    const res = NextResponse.json({ erro: "Acesso não liberado." }, { status: 401 });
    res.cookies.delete("sessao");
    return res;
  }
  return NextResponse.json({ ...usuario, papel: estado.papel });
}
