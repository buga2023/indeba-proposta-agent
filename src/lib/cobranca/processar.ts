/**
 * Orquestrador do Cobrança: planilha de contas a receber → inadimplentes + régua pronta.
 * Motor determinístico decide quem deve e quanto; a IA só escreve os 3 templates da régua,
 * e o motor preenche os valores (§2). Stateless (recebe o CSV na requisição).
 */
import type { CobrancaRequest, CobrancaResponse } from "../contracts";
import { carregarCsv } from "../financeiro/ingest";
import { analisarInadimplencia, preencherMensagem } from "./analisar";
import { gerarRegua } from "./redigir";

export async function processarCobranca(req: CobrancaRequest, hojeServidor: string): Promise<CobrancaResponse> {
  const hoje = req.hoje ?? hojeServidor;
  const tabela = carregarCsv(req.planilha.csv);
  const { inadimplentes, totalDevido, aviso } = analisarInadimplencia(tabela, hoje);

  if (!inadimplentes.length) {
    return { inadimplentes: [], totalDevido, aviso: aviso ?? "Nenhum título vencido em aberto encontrado." };
  }

  // 3 templates da régua (IA ou fixo) → preenche por inadimplente com os valores do motor.
  const regua = await gerarRegua();
  const lista = inadimplentes.map((i) => ({
    ...i,
    mensagem: preencherMensagem(regua[i.severidade], i),
  }));

  return { inadimplentes: lista, totalDevido, aviso };
}
