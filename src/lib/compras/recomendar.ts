/**
 * Recomendação de compra (IA-TEXTO). A IA recebe os números JÁ CALCULADOS pelo motor e só
 * redige a recomendação — não recalcula nem escolhe o vencedor (§2). Sem Ollama, texto fixo.
 */
import type { Cotacao } from "../contracts";
import { gerarTexto, ollamaDisponivel } from "../llm/ollama";
import { fmt } from "../financeiro/engine";

export async function recomendarCompra(cotacoes: Cotacao[], economia: string): Promise<string> {
  if (cotacoes.length === 0) return "Sem cotações para comparar.";
  const melhor = cotacoes[0];
  const baseFixa =
    `Recomendo comprar de ${melhor.fornecedor}: menor custo efetivo (R$ ${fmt(Number(melhor.custoEfetivo))}` +
    `, prazo de ${melhor.prazoDias} dias)` +
    (Number(economia) > 0 ? `, economizando R$ ${fmt(Number(economia))} frente ao 2º colocado.` : ".");

  if (!(await ollamaDisponivel())) return baseFixa;

  const ranking = cotacoes
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.fornecedor}${c.item ? ` (${c.item})` : ""}: custo total R$ ${fmt(Number(c.custoTotal))}, efetivo R$ ${fmt(Number(c.custoEfetivo))}, prazo ${c.prazoDias}d`)
    .join("\n");
  const prompt = `Você é um comprador. Com base na COMPARAÇÃO já calculada (não recalcule, não invente números), recomende em 3-4 frases a melhor compra e por quê (custo efetivo, frete embutido, prazo de pagamento). Use exatamente os valores abaixo.

Comparação (ordenada do melhor para o pior por custo efetivo):
${ranking}

Economia da 1ª opção vs a 2ª: R$ ${fmt(Number(economia))}.

Recomendação:`;
  try {
    const t = (await gerarTexto(prompt)).trim();
    return t || baseFixa;
  } catch {
    return baseFixa;
  }
}
