import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { listarAcessos } from "@/lib/acessos";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Últimos acessos ao sistema (áudio do Mateus, 10/09/2026: "ver os últimos acessos").
// SÓ o gestor: é trilha de auditoria — quem entrou, quando e de onde. Mesmo padrão de
// autorização de /api/colaboradores, com o papel vindo do BANCO (usuarioAtual), não do
// cookie, que é assinado e vale 8h.
export async function GET(req: NextRequest) {
  const sessao = await usuarioAtual(req);
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só o gestor vê os acessos." }, { status: 403 });
  }
  try {
    return NextResponse.json({ acessos: await listarAcessos() });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar os acessos.", 500);
  }
}
