/**
 * Relatório financeiro DETERMINÍSTICO — base do "relatório padrão Indeba".
 *
 * Calcula os KPIs a partir de uma planilha (Tabela), 100% via motor (`totalizar`).
 * Constituição §2: nenhum número vem do LLM. As sugestões de IA (vender mais / pagar
 * menos imposto) e o PDF são camadas SEPARADAS que apenas consomem este objeto — a IA
 * explica/sugere sobre números já calculados, nunca os altera.
 */
import { totalizar } from "./engine";
import type { Tabela } from "./ingest";

export type GrupoValor = { grupo: string; valor: number };

export type RelatorioFinanceiro = {
  numNotas: number;
  faturamentoTotal: number;
  ticketMedio: number;
  custoTotal: number | null;
  margemBruta: number | null; // faturamento − custo
  margemPct: number | null;
  pago: number | null;
  pendente: number | null;
  porCategoria: GrupoValor[];
  porVendedor: GrupoValor[];
  porCidade: GrupoValor[];
  // Procedência: quais colunas o motor usou (auditável).
  colunas: {
    valor: string | null;
    custo: string | null;
    status: string | null;
    categoria: string | null;
    vendedor: string | null;
    cidade: string | null;
  };
};

function acharCol(t: Tabela, re: RegExp): string | null {
  return t.colunas.find((c) => re.test(c)) ?? null;
}

function soma(t: Tabela, colunaValor: string | null, filtros?: Record<string, string>): number | null {
  const r = totalizar(t, { colunaValor, metrica: "soma", filtros: filtros ?? null });
  return r.ok ? (r.valor as number) : null;
}

function grupos(t: Tabela, dim: string | null): GrupoValor[] {
  if (!dim) return [];
  const r = totalizar(t, { agruparPor: dim, metrica: "soma" });
  return r.ok ? (r.tabela as GrupoValor[]) : [];
}

export function montarRelatorio(t: Tabela): RelatorioFinanceiro {
  const numNotas = t.linhas.length;

  // Coluna de faturamento: deixa o motor resolver (já prefere "valor total" a unitário).
  const somaRes = totalizar(t, { metrica: "soma" });
  const valorCol = somaRes.ok ? (somaRes.coluna as string) : null;
  const faturamentoTotal = somaRes.ok ? (somaRes.valor as number) : 0;
  const ticketMedio = numNotas ? faturamentoTotal / numNotas : 0;

  const custoCol = t.colunas.find((c) => /custo/.test(c) && t.numericas.has(c)) ?? null;
  const custoTotal = custoCol ? soma(t, custoCol) : null;
  const margemBruta = custoTotal !== null ? faturamentoTotal - custoTotal : null;
  const margemPct = margemBruta !== null && faturamentoTotal ? (margemBruta / faturamentoTotal) * 100 : null;

  // Pago vs pendente: soma o faturamento filtrando o status "pago"; o resto é pendente
  // (robusto a outros rótulos — pago + pendente = total).
  const statusCol = acharCol(t, /status|situacao/);
  let pago: number | null = null;
  let pendente: number | null = null;
  if (statusCol) {
    pago = soma(t, valorCol, { [statusCol]: "Pago" });
    pendente = pago !== null ? faturamentoTotal - pago : null;
  }

  return {
    numNotas,
    faturamentoTotal,
    ticketMedio,
    custoTotal,
    margemBruta,
    margemPct,
    pago,
    pendente,
    porCategoria: grupos(t, acharCol(t, /categoria|segmento/)),
    porVendedor: grupos(t, acharCol(t, /vendedor|representante|consultor/)),
    porCidade: grupos(t, acharCol(t, /cidade|municipio/)),
    colunas: {
      valor: valorCol,
      custo: custoCol,
      status: statusCol,
      categoria: acharCol(t, /categoria|segmento/),
      vendedor: acharCol(t, /vendedor|representante|consultor/),
      cidade: acharCol(t, /cidade|municipio/),
    },
  };
}
