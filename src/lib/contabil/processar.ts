/**
 * Orquestrador do Contábil: diário/razão (CSV/XLSX) → balancete + BP/DRE + análise.
 * Motor apura (determinístico, força D=C e A=P+PL); a IA só comenta os números (§2).
 */
import type { ContabilRequest, ContabilResponse } from "../contracts";
import { carregarCsv } from "../financeiro/ingest";
import { apurar } from "./apurar";
import { resumirContabil } from "./explicar";

export async function processarContabil(req: ContabilRequest): Promise<ContabilResponse> {
  const tabela = carregarCsv(req.planilha.csv);
  const r = apurar(tabela);
  const resumo = await resumirContabil(r);
  return { ...r, resumo };
}
