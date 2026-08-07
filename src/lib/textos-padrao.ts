import { z } from "zod";
import { prisma } from "@/lib/db";
import { consolidadaDefaults } from "./consolidada-defaults";

// Textos padrão da proposta editáveis pelo gestor (pedido do Matheus, ago/2026:
// "boleto 30 dias → 28 sem depender de programador"). O que era chumbado em
// consolidada-defaults.ts/montar.ts vira default de FÁBRICA: o valor vigente mora
// na tabela Config (chave única, JSON) e entra na proposta na MONTAGEM — proposta
// já salva não muda retroativamente (o texto assinado é o do scope persistido).
export const TextosPadrao = z.object({
  // Cards de "Condições Comerciais" do modelo Consolidada (título + texto; o ícone
  // acompanha o card e não é editável no painel).
  condicoesConsolidada: z.array(z.object({ titulo: z.string().min(1), texto: z.string().min(1), icone: z.string() })),
  mensagemFechamento: z.string().min(1),
  // Condições dos modelos Orçamento/Comercial (tabela de 4 linhas).
  condicoesComerciais: z.object({
    validade: z.string().min(1),
    prazoEntrega: z.string().min(1),
    pagamento: z.string().min(1),
    frete: z.string().min(1),
  }),
});
export type TextosPadrao = z.infer<typeof TextosPadrao>;

const CHAVE = "textosPadrao";

// Defaults de fábrica — usados quando o gestor nunca salvou nada (ou o banco caiu).
export function textosPadraoFabrica(): TextosPadrao {
  const d = consolidadaDefaults();
  return {
    condicoesConsolidada: d.condicoes.itens,
    mensagemFechamento: d.condicoes.mensagemFechamento,
    condicoesComerciais: {
      validade: "15 dias",
      prazoEntrega: "72h após aprovação",
      pagamento: "Faturamento boleto 28 dias",
      frete: "CIF",
    },
  };
}

// Banco fora do ar ou JSON inválido degrada para a fábrica — montagem de proposta
// nunca falha por causa de texto padrão (mesma postura de catalogoCompleto).
export async function carregarTextosPadrao(): Promise<TextosPadrao> {
  try {
    const c = await prisma.config.findUnique({ where: { chave: CHAVE } });
    if (!c) return textosPadraoFabrica();
    const parsed = TextosPadrao.safeParse(JSON.parse(c.valor));
    if (!parsed.success) {
      console.error("[textos-padrao] Config inválida — usando defaults de fábrica:", parsed.error.message);
      return textosPadraoFabrica();
    }
    return parsed.data;
  } catch (e) {
    console.error("[textos-padrao] indisponível — usando defaults de fábrica:", e);
    return textosPadraoFabrica();
  }
}

export async function salvarTextosPadrao(t: TextosPadrao): Promise<void> {
  const valor = JSON.stringify(t);
  await prisma.config.upsert({
    where: { chave: CHAVE },
    update: { valor },
    create: { chave: CHAVE, valor },
  });
}
