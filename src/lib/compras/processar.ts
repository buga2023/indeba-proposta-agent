/**
 * Orquestrador do Compras: planilha de cotações → ranking + recomendação.
 * Motor compara (determinístico); a IA só redige a recomendação sobre os números (§2).
 */
import type { ComprasRequest, ComprasResponse } from "../contracts";
import { carregarCsv } from "../financeiro/ingest";
import { compararCotacoes } from "./comparar";
import { recomendarCompra } from "./recomendar";

export async function processarCompras(req: ComprasRequest): Promise<ComprasResponse> {
  const tabela = carregarCsv(req.planilha.csv);
  const { cotacoes, melhorFornecedor, economia, aviso } = compararCotacoes(tabela, req.taxaMensal ?? 0.02);

  if (!cotacoes.length) {
    return { cotacoes: [], melhorFornecedor: "", economia, recomendacao: aviso ?? "Sem cotações.", aviso };
  }
  const recomendacao = await recomendarCompra(cotacoes, economia);
  return { cotacoes, melhorFornecedor, economia, recomendacao, aviso };
}
