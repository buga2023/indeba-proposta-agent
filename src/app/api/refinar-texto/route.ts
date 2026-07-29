import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reescreverApresentacao } from "@/lib/llm/escrever-texto";
import { produtoPorCodigo } from "@/lib/catalogo";

export const runtime = "nodejs";
export const maxDuration = 60; // IA pode levar alguns segundos (Vercel)

// Refino pontual do texto de apresentação (Revisão): NÃO reprocessa seleção de
// produtos — só reescreve `textoAtual` seguindo `instrucao`, com os itens da
// proposta como grounding de função (nunca inventa o que o produto faz).
const Body = z.object({
  textoAtual: z.string().min(1).max(2000),
  instrucao: z.string().min(1).max(300),
  itens: z.array(z.object({ codigo: z.string(), nome: z.string() })).default([]),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  const { textoAtual, instrucao, itens } = parsed.data;

  const produtos = itens.map((it) => ({
    nome: it.nome,
    funcoes: produtoPorCodigo(it.codigo)?.funcoes ?? [],
  }));

  const resultado = await reescreverApresentacao(textoAtual, instrucao, produtos);
  if (!resultado) {
    return NextResponse.json({ erro: "Não consegui reescrever o texto agora — tenta de novo." }, { status: 503 });
  }
  return NextResponse.json(resultado);
}
