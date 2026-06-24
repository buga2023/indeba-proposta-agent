/**
 * Orquestrador do agente financeiro (porta `src/agent.py`).
 *
 * Fluxo: pergunta -> rotear (Qwen) -> executar (motor determinístico) -> verbalizar (Qwen).
 * O Qwen nunca toca em número: decide O QUE fazer e EXPLICA o que o motor calculou.
 *
 * Stateless: recebe as planilhas (CSV) na própria requisição. Sem Ollama não há como
 * rotear a intenção, então sinaliza IaIndisponivelError (mesma postura da prospecção).
 */
import type { FinanceiroRequest, FinanceiroResponse } from "../contracts";
import { ollamaDisponivel } from "../llm/ollama";
import { baterResultados, consolidar, totalizar } from "./engine";
import { carregarCsv, parseBrl, type Tabela } from "./ingest";
import { conversar, rotear, verbalizar } from "./llm";
import { calcularImposto } from "./tax-kb";

export class IaIndisponivelError extends Error {
  constructor() {
    super("IA indisponível: o agente financeiro precisa do Ollama para entender a pergunta.");
    this.name = "IaIndisponivelError";
  }
}

/** Pega o maior número plausível do texto (base p/ cálculo de imposto). */
function extrairValor(texto: string): number | null {
  const achados = texto.match(/\d[\d.,]*/g) ?? [];
  const vals = achados.map((x) => parseBrl(x)).filter((v) => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** Primeira coluna comum e textual (não-numérica) entre duas tabelas — chave de conciliação. */
function primeiraChave(a: Tabela, b: Tabela): string {
  const comuns = a.colunas.filter((c) => b.colunas.includes(c) && !a.numericas.has(c));
  if (comuns.length) return comuns[0];
  return a.colunas[0] ?? "id";
}

export async function perguntar(req: FinanceiroRequest): Promise<FinanceiroResponse> {
  if (!(await ollamaDisponivel())) throw new IaIndisponivelError();

  // Ingestão determinística de todas as planilhas enviadas.
  const planilhas: Record<string, Tabela> = {};
  for (const p of req.planilhas) planilhas[p.nome] = carregarCsv(p.csv);
  const nomes = Object.keys(planilhas);
  let atual = req.planilhaAtual && planilhas[req.planilhaAtual] ? req.planilhaAtual : nomes.at(-1) ?? null;

  const colunasAtual = atual ? planilhas[atual].colunas : [];
  const rota = await rotear(req.pergunta, colunasAtual, nomes);

  // duvida_tributaria / conversa: resposta puramente textual (sem motor).
  if (rota.intencao === "duvida_tributaria" || rota.intencao === "conversa") {
    const resposta = await conversar(req.pergunta);
    return { resposta, tipo: rota.intencao, resumoNumerico: "", planilhaAtual: atual };
  }

  let res: ReturnType<typeof totalizar>;

  if (rota.intencao === "consultar_dado") {
    if (!atual) {
      return semPlanilha("Carregue uma planilha primeiro para eu consultar os dados.", atual);
    }
    res = totalizar(planilhas[atual], {
      colunaValor: rota.coluna_valor,
      agruparPor: rota.agrupar_por,
      metrica: rota.metrica ?? "soma",
      filtros: rota.filtros,
    });
  } else if (rota.intencao === "consolidar") {
    const c = consolidar(planilhas);
    if (c.ok && c.tabela) {
      planilhas["consolidado"] = c.tabela;
      atual = "consolidado";
    }
    res = c;
  } else if (rota.intencao === "bater_resultados") {
    const reais = nomes.filter((n) => n !== "consolidado");
    const nomeA = rota.fonte_a && planilhas[rota.fonte_a] ? rota.fonte_a : reais[0];
    const nomeB = rota.fonte_b && planilhas[rota.fonte_b] ? rota.fonte_b : reais[1];
    if (!nomeA || !nomeB || !planilhas[nomeA] || !planilhas[nomeB]) {
      return semPlanilha("Pra conciliar eu preciso de duas planilhas carregadas.", atual);
    }
    res = baterResultados(planilhas[nomeA], planilhas[nomeB], {
      chave: rota.chave ?? primeiraChave(planilhas[nomeA], planilhas[nomeB]),
      colunaValor: rota.coluna_valor,
      nomeA,
      nomeB,
    });
  } else {
    // calcular_imposto
    const base = extrairValor(req.pergunta);
    if (base === null || !rota.imposto || !rota.regime) {
      return semPlanilha(
        'Pra calcular imposto eu preciso de imposto, regime e base. Ex.: "calcule ICMS no lucro presumido sobre 10.000".',
        atual,
      );
    }
    res = calcularImposto(base, rota.regime, rota.imposto);
  }

  if (!res.ok) {
    return semPlanilha(res.erro, atual);
  }

  const resposta = await verbalizar(req.pergunta, res.resumoNumerico);
  return { resposta, tipo: res.tipo, resumoNumerico: res.resumoNumerico, planilhaAtual: atual };
}

// Erro "amigável" do motor: a verdade textual já é a própria mensagem (sem IA).
function semPlanilha(msg: string, atual: string | null): FinanceiroResponse {
  return { resposta: msg, tipo: "erro", resumoNumerico: msg, planilhaAtual: atual };
}
