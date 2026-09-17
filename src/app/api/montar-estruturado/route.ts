import { NextRequest, NextResponse } from "next/server";
import { EntradaEstruturada } from "@/lib/contracts";
import { montarPropostaEstruturada } from "@/lib/montar";
import { validarSessao } from "@/lib/auth";
import { buscarColaborador } from "@/lib/auth-db";
import { respostaErro } from "@/lib/erro";
import { consultorDoDono } from "@/lib/propostas";

export const runtime = "nodejs";

// Infos já estruturadas (sem briefing/IA) → PropostaScope (mesmo objeto canônico).
export async function POST(req: NextRequest) {
  const parsed = EntradaEstruturada.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const usuario = await validarSessao(req.cookies.get("sessao")?.value);
    // Telefone não viaja no cookie de sessão: vem do cadastro (mesmo recorte de /api/montar).
    const telefone = usuario ? (await buscarColaborador(usuario.email))?.telefone ?? null : null;
    // Remontagem ("Editar" no histórico) de uma proposta que já tem dono: quem assina é o
    // dono, não quem está logado — senão o gestor editando a proposta transferida devolvia
    // a capa para o nome dele (áudio do Mateus, 16/09/2026).
    const dono = parsed.data.id ? await consultorDoDono(parsed.data.id) : null;
    const scope = await montarPropostaEstruturada(
      parsed.data,
      dono ?? (usuario ? { nome: usuario.nome, email: usuario.email, telefone } : null),
    );
    return NextResponse.json(scope);
  } catch (e) {
    return respostaErro(e, "Erro", 400);
  }
}
