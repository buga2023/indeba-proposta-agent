import { NextRequest, NextResponse } from "next/server";
import { AreaVisita, VisitaCarteiraCreate, VisitaCarteiraUpdate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import {
  criarVisita,
  listarVisitas,
  editarVisita,
  excluirVisita,
  restaurarVisita,
  excluirVisitaDefinitivo,
} from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Relatório de Visitas de Rotina — existe nas DUAS telas (Ferramentas Comerciais e
// Técnicas, foto do bloco do Mateus); `?area=` diz qual porta está pedindo. Gestor vê
// todos os registros, vendedor vê só os seus — mesmo recorte de /api/chamados.
// `?excluidas=1` lista a aba Excluídos (lápides) em vez dos vivos.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const area = AreaVisita.safeParse(req.nextUrl.searchParams.get("area") ?? "tecnica");
  if (!area.success) return NextResponse.json({ erro: "Área inválida." }, { status: 400 });
  const excluidas = req.nextUrl.searchParams.get("excluidas") === "1";
  try {
    const visitas = await listarVisitas(usuario, area.data, excluidas);
    return NextResponse.json({ visitas, souGestor: usuario.papel === "admin" });
  } catch (e) {
    return respostaErro(e, "Falha ao listar as visitas.", 500);
  }
}

// Lançar visita. O autor vem da sessão (dado crítico não vem do cliente).
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = VisitaCarteiraCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const visita = await criarVisita(usuario.email, parsed.data);
    return NextResponse.json(visita, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao registrar a visita.", 500);
  }
}

// Editar registro (áudio do Mateus, 25/08/2026): vendedor edita os próprios, gestor
// qualquer um; a data não muda. `?acao=restaurar` tira o registro da aba Excluídos —
// operação de gestor, como a exclusão.
export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Registro não informado." }, { status: 400 });

  if (req.nextUrl.searchParams.get("acao") === "restaurar") {
    if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode restaurar registros." }, { status: 403 });
    try {
      const ok = await restaurarVisita(usuario, id);
      if (!ok) return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return respostaErro(e, "Falha ao restaurar a visita.", 500);
    }
  }

  const parsed = VisitaCarteiraUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const ok = await editarVisita(usuario, id, parsed.data);
    if (!ok) return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao editar a visita.", 500);
  }
}

// Excluir é SÓ do gestor (áudio do Mateus, 25/08/2026: o usuário só edita). Sem
// `?definitivo=1` vira lápide (aba Excluídos); com, some de vez — e só de lá.
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode excluir registros." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Registro não informado." }, { status: 400 });
  const definitivo = req.nextUrl.searchParams.get("definitivo") === "1";
  try {
    const ok = definitivo ? await excluirVisitaDefinitivo(usuario, id) : await excluirVisita(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir a visita.", 500);
  }
}
