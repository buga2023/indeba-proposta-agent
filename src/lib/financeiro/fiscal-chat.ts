/**
 * Cérebro de chat fiscal — responde dúvidas de APURAÇÃO sobre os motores determinísticos,
 * sempre com MEMÓRIA DE CÁLCULO (o porquê) e FONTE. Pensado para ser chamado pelo router
 * (agente.ts) como handler das intenções de apuração — não é um segundo agente.
 *
 * Roteamento por palavra-chave (determinístico, não precisa de LLM): se faltar um dado
 * (ex.: RBT12 para o Simples), ele PEDE o dado — nunca inventa. §2/§6.
 */
import { compararRegimes, type Atividade, type Regime } from "./apuracao";
import { calcularDAS, fatorR, type Anexo } from "./simples";
import { apurarIcms } from "./nao-cumulativo";
import { irpjCsllPresumido } from "./tributos-lucro";
import { apurarFolha } from "./apuracao-folha";
import { buscarTributo, AVISO_TRIBUTOS } from "./tributos-referencia";

export type ContextoFiscal = {
  ano: number;
  atividade?: Atividade;
  regime?: Regime;
  faturamento?: number;
  compras?: number;
  folha?: number;
  rbt12?: number;
  receitaMes?: number;
  anexo?: Anexo;
};

export type RespostaFiscal = {
  intencao: string;
  resposta: string; // frase determinística pronta (o chat pode reescrever, números não)
  memoria: string | null; // o "porquê" auditável
  fonte: string | null;
};

const temAlgum = (t: string, res: RegExp[]) => res.some((re) => re.test(t));

export function responderFiscal(pergunta: string, ctx: ContextoFiscal): RespostaFiscal {
  const p = pergunta.toLowerCase();

  // 1) Dúvida conceitual: "o que é / como apura <tributo>"
  if (temAlgum(p, [/o que [eé]/, /como (se )?apura/, /explica|defini/])) {
    const t = buscarTributo(pergunta.replace(/[^a-zA-ZÀ-ÿ\s/]/g, " "));
    if (t) {
      return {
        intencao: "duvida_tributaria",
        resposta: `${t.sigla} (${t.nome}, ${t.esfera}): incide sobre ${t.incideSobre}. Como apura: ${t.comoApurar}`,
        memoria: null,
        fonte: `${t.fonte}${t.status === "em_extincao" ? " · em extinção pela reforma" : t.status === "novo" ? " · novo (reforma)" : ""}`,
      };
    }
  }

  // 2) Comparar regimes ("qual paga menos imposto / melhor regime")
  if (temAlgum(p, [/regime/, /paga menos/, /simples ou|presumido ou|melhor regime/])) {
    if (!ctx.faturamento || !ctx.atividade) {
      return pedir("comparar_regimes", "Pra comparar os regimes preciso do faturamento e da atividade (comércio/serviço/indústria).");
    }
    const { ranking, aviso } = compararRegimes({ atividade: ctx.atividade, ano: ctx.ano, faturamento: ctx.faturamento });
    const linha = ranking.map((r) => `${r.regime} ${pctBrl(r.total)} (carga ${r.cargaEfetiva.toFixed(2)}%)`).join(" · ");
    return {
      intencao: "comparar_regimes",
      resposta: `Carga sobre faturamento por regime (menor → maior): ${linha}. Menor: ${ranking[0].regime}.`,
      memoria: linha,
      fonte: aviso,
    };
  }

  // 3) Simples / DAS
  if (temAlgum(p, [/\bdas\b/, /simples/])) {
    if (!ctx.rbt12 || !ctx.anexo || !ctx.receitaMes) {
      return pedir("simples_das", "Pro DAS preciso da RBT12 (receita 12 meses), do anexo e da receita do mês.");
    }
    const r = calcularDAS(ctx.receitaMes, ctx.rbt12, ctx.anexo);
    return { intencao: "simples_das", resposta: `DAS = ${brl(r.das)} (efetiva ${r.aliquotaEfetiva.toFixed(2)}%).`, memoria: r.memoria, fonte: r.fonte };
  }

  // 4) Fator R
  if (/fator r/.test(p)) {
    if (!ctx.folha || !ctx.rbt12) return pedir("fator_r", "Pro Fator R preciso da folha (12 meses) e da RBT12.");
    const r = fatorR(ctx.folha, ctx.rbt12);
    return { intencao: "fator_r", resposta: `Fator R = ${r.fatorR.toFixed(2)}% → Anexo ${r.anexoAplicavel}.`, memoria: r.memoria, fonte: null };
  }

  // 5) ICMS (não-cumulativo)
  if (/icms/.test(p)) {
    if (!ctx.faturamento) return pedir("icms", "Pra apurar o ICMS preciso do faturamento (e das compras, se quiser o crédito).");
    const r = apurarIcms({ vendas: ctx.faturamento, compras: ctx.compras ?? 0, regime: ctx.regime ?? "presumido", ano: ctx.ano });
    return { intencao: "icms", resposta: `ICMS a recolher = ${brl(r.aRecolher)}.`, memoria: r.memoria, fonte: "alíquota da base datada (validar SEFAZ-BA)" };
  }

  // 6) IRPJ / CSLL
  if (temAlgum(p, [/irpj/, /csll/, /imposto de renda|lucro/])) {
    if (!ctx.faturamento || !ctx.atividade) return pedir("irpj_csll", "Pra IRPJ/CSLL preciso da receita e da atividade.");
    const r = irpjCsllPresumido({ receita: ctx.faturamento, atividade: ctx.atividade });
    return { intencao: "irpj_csll", resposta: `IRPJ ${brl(r.irpjTotal)} + CSLL ${brl(r.csll)} = ${brl(r.total)}.`, memoria: r.memoria, fonte: r.fonte };
  }

  // 7) Folha
  if (temAlgum(p, [/folha/, /encargo/, /inss patronal/, /fgts/])) {
    if (!ctx.folha) return pedir("folha", "Pra apurar os encargos preciso do total da folha.");
    const r = apurarFolha({ folha: ctx.folha, ano: ctx.ano, regime: ctx.regime ?? null });
    return { intencao: "folha", resposta: `Encargos patronais = ${brl(r.totalEncargos)}; custo total da folha = ${brl(r.custoTotalFolha)}.`, memoria: r.memoria, fonte: r.aviso };
  }

  return {
    intencao: "indefinida",
    resposta: "Posso apurar Simples/DAS, ICMS, IRPJ/CSLL, encargos de folha, comparar regimes ou explicar um tributo. O que você quer?",
    memoria: null,
    fonte: AVISO_TRIBUTOS,
  };
}

function pedir(intencao: string, msg: string): RespostaFiscal {
  return { intencao, resposta: msg, memoria: null, fonte: null };
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pctBrl = (v: number) => brl(v);
