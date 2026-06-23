import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { montarProposta } from "@/lib/montar";
import { Tipo } from "@/lib/contracts";
import { detectarTipo, TIPOS_LABEL } from "@/lib/tipo-proposta";

export const runtime = "nodejs";
export const maxDuration = 60; // IA pode levar alguns segundos (Vercel)

// Limites de tamanho: o briefing (com anexos concatenados) vira prompt da IA —
// cap evita abuso/DoS. Local, mas defensivo.
const Body = z.object({
  briefing: z.string().min(1).max(20_000),
  razaoSocial: z.string().min(1).max(200),
  cnpj: z.string().max(40).nullable().default(null),
  segmento: z.string().max(100).nullable().default(null),
  tipo: Tipo.optional(), // se o usuário já escolheu o tipo (após perguntar)
  // Contexto opcional vindo da prospecção: a "dor" do prospect personaliza o
  // texto de apresentação. Tempero do texto — não influencia preço nem item.
  contextoProspeccao: z
    .object({
      problema: z.string().max(800).default(""),
      comoAjudar: z.string().max(800).default(""),
    })
    .nullable()
    .default(null),
});

const TIPOS_OPCOES = (["orcamento", "implantacao", "comercial"] as const).map((t) => ({
  value: t,
  label: TIPOS_LABEL[t],
}));

// Briefing (linguagem natural) → PropostaScope (objeto canônico).
// Se o tipo de proposta não vier e não for detectável no prompt, NÃO chuta:
// responde { precisaTipo: true } pra UI perguntar (melhor perguntar do que errar).
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  const { briefing, razaoSocial, cnpj, segmento, tipo, contextoProspeccao } = parsed.data;

  const tipoFinal = tipo ?? detectarTipo(briefing).tipo;
  if (!tipoFinal) {
    return NextResponse.json(
      { precisaTipo: true, motivo: detectarTipo(briefing).motivo, tipos: TIPOS_OPCOES },
      { status: 200 },
    );
  }

  const scope = await montarProposta(briefing, { razaoSocial, cnpj, segmento }, tipoFinal, contextoProspeccao);

  // Seleção vazia = o briefing não casou com nada do catálogo. Não emite proposta
  // muda: sinaliza pro vendedor refinar (melhor avisar do que entregar PDF vazio).
  if (scope.itens.length === 0) {
    return NextResponse.json({
      ...scope,
      aviso:
        "Nenhum produto do catálogo casou com o briefing. Refine a descrição (linha, função, método) ou use o caminho estruturado para informar os itens manualmente.",
    });
  }
  return NextResponse.json(scope);
}
