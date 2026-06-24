/**
 * Handoff Proposta → Financeiro (adapter DETERMINÍSTICO).
 *
 * Converte um `PropostaScope` na planilha (`Tabela`) que o motor financeiro consome, para
 * o vendedor analisar totais/impostos/margem da MESMA proposta. Constituição §1/§2: o
 * preço vem SEMPRE do catálogo (`embalagem.preco`, decimal string) — nunca do LLM. O total
 * é somado em CENTAVOS inteiros para casar exatamente com o total da proposta (sem float).
 */
import type { PropostaScope, PropostaItem, PlanilhaInput } from "../contracts";
import type { Tabela } from "./ingest";

// Colunas monetárias: emitidas com 2 casas decimais (ponto) — o parseBrl do ingest lê
// "260.00" como decimal (frac de 2 dígitos nunca dispara a heurística de milhar).
const COLUNAS_MOEDA = new Set(["preco_unitario", "valor_total"]);

// "130.00" -> 13000 centavos. Preço é decimal string (§preço: nunca float).
function aCentavos(precoDecimal: string): number {
  const [inteiro, frac = ""] = precoDecimal.split(".");
  return Number(inteiro) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

// Subtotal do item em centavos: preço da 1ª embalagem × quantidade (modelo de orçamento,
// mesma regra do PDF). Item sem embalagem → 0 (lacuna sinalizada, não inventada).
export function subtotalCentavos(item: PropostaItem): number {
  const preco = item.embalagens[0]?.preco ?? "0.00";
  return aCentavos(preco) * item.quantidade;
}

// Total da proposta em centavos — a "verdade" determinística (base do teste-guardião).
export function totalPropostaCentavos(scope: PropostaScope): number {
  return scope.itens.reduce((acc, it) => acc + subtotalCentavos(it), 0);
}

// PropostaScope -> Tabela do financeiro. Uma linha por item; `valor_total` casa com as
// PISTAS_VALOR do motor (resolverColunaValor), então `totalizar(soma)` bate o total.
export function propostaParaPlanilha(scope: PropostaScope): Tabela {
  const colunas = ["codigo", "produto", "quantidade", "preco_unitario", "valor_total"];
  const numericas = new Set(["quantidade", "preco_unitario", "valor_total"]);
  const linhas = scope.itens.map((it) => ({
    codigo: it.codigo,
    produto: it.nome,
    quantidade: it.quantidade,
    preco_unitario: aCentavos(it.embalagens[0]?.preco ?? "0.00") / 100,
    valor_total: subtotalCentavos(it) / 100,
  }));
  return { colunas, numericas, linhas };
}

// Escapa um campo CSV (delimitador ';'): aspas se contiver ';', '"' ou quebra de linha.
function csvCampo(s: string): string {
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// PropostaScope -> CSV (delimitador ';', BR-safe) que o ingest do financeiro reconstrói
// exatamente. Moeda com 2 casas (ponto decimal); inteiros como estão.
export function propostaParaCsv(scope: PropostaScope): string {
  const t = propostaParaPlanilha(scope);
  const linha = (vals: Array<string | number>) => vals.map((v) => csvCampo(String(v))).join(";");
  const corpo = t.linhas.map((r) =>
    linha(t.colunas.map((c) => (COLUNAS_MOEDA.has(c) ? Number(r[c]).toFixed(2) : r[c]))),
  );
  return [linha(t.colunas), ...corpo].join("\n");
}

// PropostaScope -> PlanilhaInput {nome, csv} — o objeto EXATO que a FinanceiroScreen
// empilha em `planilhas`. É só isto que o botão "Analisar no financeiro" precisa injetar.
export function propostaParaPlanilhaInput(scope: PropostaScope): PlanilhaInput {
  return { nome: `Proposta ${scope.cliente.razaoSocial}`.slice(0, 120), csv: propostaParaCsv(scope) };
}
