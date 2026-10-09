import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { FERRAMENTAS, PLANOS, ferramentasHabilitadas, planoDe, salvarFerramentas } from "@/lib/plano";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Plano de ferramentas da instalação (lib/plano.ts). Leitura para qualquer usuário logado —
// a UI precisa saber o que esconder; gravação só do gestor.
export async function GET(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const ferramentas = await ferramentasHabilitadas();
  return NextResponse.json({ ferramentas, plano: planoDe(ferramentas), catalogo: FERRAMENTAS, presets: PLANOS });
}

export async function PUT(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (u.papel !== "admin") return NextResponse.json({ erro: "Só o gestor." }, { status: 403 });
  const corpo = (await req.json().catch(() => ({}))) as { ferramentas?: unknown; plano?: unknown };
  const lista = typeof corpo.plano === "string" && corpo.plano in PLANOS ? PLANOS[corpo.plano as keyof typeof PLANOS] : corpo.ferramentas;
  if (!Array.isArray(lista) || !lista.every((x) => typeof x === "string")) {
    return NextResponse.json({ erro: "Informe `ferramentas` (lista de ids) ou `plano` (basic, regular, premium, completo)." }, { status: 400 });
  }
  try {
    const ferramentas = await salvarFerramentas(lista as string[]);
    return NextResponse.json({ ok: true, ferramentas, plano: planoDe(ferramentas) });
  } catch (e) {
    return respostaErro(e, "Falha ao salvar o plano.", 500);
  }
}
