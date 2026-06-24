/**
 * Motor financeiro DETERMINÍSTICO (porta `src/engine.py`).
 *
 * REGRA DE OURO (constituição §2): nenhum número deste módulo vem de LLM. Tudo é
 * calculado aqui. Cada função devolve `resumoNumerico` — a verdade textual que a camada
 * de linguagem (Qwen) vai apenas explicar, sem alterar.
 */
import type { MetricaFinanceira } from "../contracts";
import type { Tabela } from "./ingest";

/** 1234.5 -> '1.234,50' (formato BR). */
export function fmt(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

const PISTAS_VALOR = ["valor", "total", "preco", "receita", "venda", "montante", "custo"];

function resolverColunaValor(t: Tabela, coluna?: string | null): string | null {
  if (coluna && t.colunas.includes(coluna)) return coluna;
  const candidatos = [...t.numericas];
  const prefer = candidatos.filter((c) => PISTAS_VALOR.some((p) => c.includes(p)));
  if (prefer.length) return prefer[0];
  return candidatos.length ? candidatos[0] : null;
}

type ResOk = { ok: true; tipo: string; resumoNumerico: string; [k: string]: unknown };
type ResErro = { ok: false; erro: string };
export type ResultadoMotor = ResOk | ResErro;

function num(linha: Record<string, string | number>, col: string): number {
  const v = linha[col];
  return typeof v === "number" ? v : 0;
}

export type OpcoesTotalizar = {
  colunaValor?: string | null;
  agruparPor?: string | null;
  metrica?: MetricaFinanceira;
  filtros?: Record<string, string> | null;
};

/** Soma/média/contagem/máx/mín, opcionalmente agrupado e/ou filtrado. */
export function totalizar(t: Tabela, opcoes: OpcoesTotalizar = {}): ResultadoMotor {
  const { colunaValor, agruparPor, metrica = "soma", filtros } = opcoes;

  let linhas = t.linhas;
  const aplicados: Record<string, string> = {};
  if (filtros) {
    for (const [col, val] of Object.entries(filtros)) {
      if (t.colunas.includes(col)) {
        linhas = linhas.filter((r) => String(r[col]).toLowerCase() === String(val).toLowerCase());
        aplicados[col] = val;
      }
    }
  }

  const col = resolverColunaValor(t, colunaValor);
  if (!col) return { ok: false, erro: "Nenhuma coluna numérica encontrada para calcular." };

  const ehDinheiro = metrica !== "contagem";
  const valores = linhas.map((r) => num(r, col));
  const filtrosTxt = Object.keys(aplicados).length
    ? JSON.stringify(aplicados)
    : "nenhum";

  const aplicarMetrica = (xs: number[]): number => {
    if (xs.length === 0) return 0;
    switch (metrica) {
      case "soma":
        return xs.reduce((a, b) => a + b, 0);
      case "media":
        return xs.reduce((a, b) => a + b, 0) / xs.length;
      case "contagem":
        return xs.length;
      case "max":
        return Math.max(...xs);
      case "min":
        return Math.min(...xs);
    }
  };

  if (agruparPor && t.colunas.includes(agruparPor)) {
    const grupos = new Map<string, number[]>();
    for (const r of linhas) {
      const k = String(r[agruparPor]);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(num(r, col));
    }
    const tabela = [...grupos.entries()]
      .map(([grupo, xs]) => ({ grupo, valor: aplicarMetrica(xs) }))
      .sort((a, b) => b.valor - a.valor);
    const linhasTxt = tabela
      .map((r) => `- ${r.grupo}: ` + (ehDinheiro ? `R$ ${fmt(r.valor)}` : `${r.valor}`))
      .join("\n");
    const total = ehDinheiro
      ? valores.reduce((a, b) => a + b, 0)
      : linhas.length;
    let resumo =
      `${metrica} de "${col}" por "${agruparPor}" ` +
      `(${linhas.length} linhas, filtros=${filtrosTxt}):\n${linhasTxt}`;
    if (ehDinheiro) resumo += `\nTotal geral: R$ ${fmt(total)}`;
    return {
      ok: true,
      tipo: "totalizar_agrupado",
      coluna: col,
      tabela,
      total_geral: total,
      resumoNumerico: resumo,
    };
  }

  const valor = ehDinheiro ? aplicarMetrica(valores) : linhas.length;
  const valorTxt = ehDinheiro ? `R$ ${fmt(valor)}` : String(valor);
  const resumo =
    `${metrica} de "${col}" = ${valorTxt} ` + `(${linhas.length} linhas, filtros=${filtrosTxt})`;
  return { ok: true, tipo: "totalizar", coluna: col, valor, resumoNumerico: resumo };
}

/** Junta várias planilhas em uma, marcando a fonte de cada linha. */
export function consolidar(planilhas: Record<string, Tabela>): ResultadoMotor & { tabela?: Tabela } {
  const partes = Object.entries(planilhas).filter(([nome]) => nome !== "consolidado");
  if (!partes.length) return { ok: false, erro: "Nada para consolidar." };

  const colunasSet = new Set<string>();
  const numericas = new Set<string>();
  const linhas: Array<Record<string, string | number>> = [];
  const porFonte: Record<string, number> = {};
  for (const [nome, t] of partes) {
    t.colunas.forEach((c) => colunasSet.add(c));
    t.numericas.forEach((c) => numericas.add(c));
    porFonte[nome] = t.linhas.length;
    for (const r of t.linhas) linhas.push({ ...r, _fonte: nome });
  }
  colunasSet.add("_fonte");
  const colunas = [...colunasSet];
  const tabela: Tabela = { colunas, numericas, linhas };

  const colValor = resolverColunaValor(tabela);
  let resumo =
    `Consolidadas ${partes.length} planilhas em ${linhas.length} linhas. ` +
    `Por fonte: ` +
    Object.entries(porFonte)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
  if (colValor) {
    const total = linhas.reduce((a, r) => a + num(r, colValor), 0);
    resumo += `. Total de "${colValor}": R$ ${fmt(total)}`;
  }
  return {
    ok: true,
    tipo: "consolidar",
    tabela,
    linhas: linhas.length,
    por_fonte: porFonte,
    resumoNumerico: resumo,
  };
}

export type OpcoesBater = {
  chave: string;
  colunaValor?: string | null;
  tolerancia?: number;
  nomeA?: string;
  nomeB?: string;
};

/** Concilia duas fontes pela coluna-chave e aponta divergências de valor. */
export function baterResultados(a: Tabela, b: Tabela, opcoes: OpcoesBater): ResultadoMotor {
  const { chave, colunaValor, tolerancia = 0.01, nomeA = "A", nomeB = "B" } = opcoes;
  if (!a.colunas.includes(chave) || !b.colunas.includes(chave)) {
    return { ok: false, erro: `Coluna-chave "${chave}" precisa existir nas duas planilhas.` };
  }
  const cva = resolverColunaValor(a, colunaValor);
  const cvb = resolverColunaValor(b, colunaValor);
  if (!cva || !cvb) {
    return { ok: false, erro: "Coluna de valor não encontrada para conciliação." };
  }

  const somarPorChave = (t: Tabela, col: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of t.linhas) {
      const k = String(r[chave]);
      m.set(k, (m.get(k) ?? 0) + num(r, col));
    }
    return m;
  };
  const mapA = somarPorChave(a, cva);
  const mapB = somarPorChave(b, cvb);
  const chaves = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();

  const soA: Array<{ chave: string; valor: number }> = [];
  const soB: Array<{ chave: string; valor: number }> = [];
  const divergentes: Array<{ chave: string; valor_a: number; valor_b: number; diferenca: number }> =
    [];
  const iguais: string[] = [];
  for (const k of chaves) {
    const va = mapA.get(k) ?? 0;
    const vb = mapB.get(k) ?? 0;
    if (!mapB.has(k)) soA.push({ chave: k, valor: va });
    else if (!mapA.has(k)) soB.push({ chave: k, valor: vb });
    else if (Math.abs(va - vb) > tolerancia)
      divergentes.push({
        chave: k,
        valor_a: va,
        valor_b: vb,
        diferenca: Math.round((va - vb) * 100) / 100,
      });
    else iguais.push(k);
  }

  const linhasTxt: string[] = [];
  if (divergentes.length) {
    linhasTxt.push("Divergências:");
    for (const d of divergentes) {
      linhasTxt.push(
        `  - ${d.chave}: ${nomeA}=R$ ${fmt(d.valor_a)} | ` +
          `${nomeB}=R$ ${fmt(d.valor_b)} | dif=R$ ${fmt(d.diferenca)}`,
      );
    }
  }
  if (soA.length) {
    linhasTxt.push(`Só em ${nomeA}: ` + soA.map((r) => `${r.chave} (R$ ${fmt(r.valor)})`).join(", "));
  }
  if (soB.length) {
    linhasTxt.push(`Só em ${nomeB}: ` + soB.map((r) => `${r.chave} (R$ ${fmt(r.valor)})`).join(", "));
  }

  let resumo =
    `Conciliação por "${chave}": ${iguais.length} batem, ${divergentes.length} divergem, ` +
    `${soA.length} só em ${nomeA}, ${soB.length} só em ${nomeB}.`;
  if (linhasTxt.length) resumo += "\n" + linhasTxt.join("\n");
  return {
    ok: true,
    tipo: "bater_resultados",
    iguais: iguais.length,
    divergentes,
    so_a: soA,
    so_b: soB,
    resumoNumerico: resumo,
  };
}
