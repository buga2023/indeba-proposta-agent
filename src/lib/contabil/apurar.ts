/**
 * Motor contábil DETERMINÍSTICO (§2): força os dois invariantes.
 *
 * Entrada: diário/razão (1 linha por partida) — colunas conta, débito, crédito (+ opcional
 * natureza, histórico, lançamento). O código valida Σdébitos = Σcréditos, monta o balancete
 * e, com a natureza das contas, as demonstrações (BP/DRE). Se D=C, o BP fecha por construção.
 * A IA não entra aqui: nenhum saldo vem do modelo. Sem natureza, sinaliza a lacuna.
 */
import type { ContaBalancete, ContabilResponse, Divergencia, NaturezaConta } from "../contracts";
import type { Tabela } from "../financeiro/ingest";

// Plano de contas padrão por prefixo do código (curável; o ideal é o contador fornecer).
// Esquema comum BR: 1 Ativo · 2 Passivo · 3 PL · 4 Receita · 5 Custo · 6 Despesa.
const NATUREZA_POR_PREFIXO: Record<string, NaturezaConta> = {
  "1": "ativo",
  "2": "passivo",
  "3": "pl",
  "4": "receita",
  "5": "custo",
  "6": "despesa",
};

const DEVEDORAS = new Set<NaturezaConta>(["ativo", "custo", "despesa"]);

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizarNatureza(s: string): NaturezaConta | null {
  const v = s.toLowerCase();
  if (/ativo/.test(v)) return "ativo";
  if (/passiv/.test(v)) return "passivo";
  if (/p\.?l\.?|patrim/.test(v)) return "pl";
  if (/receit/.test(v)) return "receita";
  if (/custo/.test(v)) return "custo";
  if (/despes/.test(v)) return "despesa";
  return null;
}

function colObj(t: Tabela, re: RegExp): string | undefined {
  return t.colunas.find((c) => re.test(c));
}
function num(linha: Record<string, string | number>, col: string | undefined): number {
  if (!col) return 0;
  const v = linha[col];
  return typeof v === "number" ? v : 0;
}

type Acc = { debito: number; credito: number; natureza: NaturezaConta | null };

export function apurar(t: Tabela): ContabilResponse {
  const colConta = colObj(t, /conta/) ?? colObj(t, /^c[oó]digo$|hist[oó]rico/) ?? t.colunas[0];
  const colDebito = t.colunas.find((c) => t.numericas.has(c) && /d[eé]bito|debit/.test(c));
  const colCredito = t.colunas.find((c) => t.numericas.has(c) && /cr[eé]dito|credit/.test(c));
  const colNatureza = colObj(t, /natureza|tipo_conta|grupo/);
  const colLanc = colObj(t, /lan[çc]amento|documento|^doc$|partida|n[º°]/);

  if (!colDebito || !colCredito) {
    return vazia("Não encontrei as colunas de DÉBITO e CRÉDITO — o diário precisa de uma coluna para cada.");
  }

  // Agrega por conta + descobre a natureza (coluna explícita > prefixo do código).
  const contas = new Map<string, Acc>();
  const semNatureza = new Set<string>();
  for (const r of t.linhas) {
    const conta = String(r[colConta] ?? "").trim();
    if (!conta) continue;
    const acc = contas.get(conta) ?? { debito: 0, credito: 0, natureza: null };
    acc.debito += num(r, colDebito);
    acc.credito += num(r, colCredito);
    if (!acc.natureza) {
      acc.natureza = colNatureza ? normalizarNatureza(String(r[colNatureza] ?? "")) : null;
      if (!acc.natureza) acc.natureza = NATUREZA_POR_PREFIXO[conta.trim()[0]] ?? null;
    }
    contas.set(conta, acc);
  }
  for (const [conta, a] of contas) if (!a.natureza) semNatureza.add(conta);

  // Balancete + invariante da partida dobrada.
  let totDeb = 0;
  let totCred = 0;
  const balancete: ContaBalancete[] = [...contas.entries()]
    .map(([conta, a]) => {
      totDeb += a.debito;
      totCred += a.credito;
      const credora = a.natureza ? !DEVEDORAS.has(a.natureza) : false;
      const saldo = credora ? a.credito - a.debito : a.debito - a.credito;
      return {
        conta,
        natureza: a.natureza,
        debito: round2(a.debito).toFixed(2),
        credito: round2(a.credito).toFixed(2),
        saldo: round2(saldo).toFixed(2),
      };
    })
    .sort((x, y) => x.conta.localeCompare(y.conta));

  totDeb = round2(totDeb);
  totCred = round2(totCred);
  const partidaDobradaOk = Math.abs(totDeb - totCred) < 0.01;

  const divergencias: Divergencia[] = [];
  if (!partidaDobradaOk) {
    divergencias.push({ descricao: `Partida dobrada NÃO bate: Σdébitos (R$ ${totDeb.toFixed(2)}) ≠ Σcréditos (R$ ${totCred.toFixed(2)}).`, valor: round2(totDeb - totCred).toFixed(2) });
  }
  // Por lançamento (se houver identificador): cada lançamento deve balancear.
  if (colLanc) {
    const porLanc = new Map<string, { d: number; c: number }>();
    for (const r of t.linhas) {
      const id = String(r[colLanc] ?? "").trim();
      if (!id) continue;
      const g = porLanc.get(id) ?? { d: 0, c: 0 };
      g.d += num(r, colDebito);
      g.c += num(r, colCredito);
      porLanc.set(id, g);
    }
    for (const [id, g] of porLanc) {
      if (Math.abs(round2(g.d) - round2(g.c)) >= 0.01) {
        divergencias.push({ descricao: `Lançamento "${id}" não balanceia (D R$ ${round2(g.d).toFixed(2)} × C R$ ${round2(g.c).toFixed(2)}).`, valor: round2(g.d - g.c).toFixed(2) });
      }
    }
  }

  // Demonstrações — só com TODAS as contas classificadas (senão a equação não fecharia).
  let bp: ContabilResponse["bp"] = null;
  let dre: ContabilResponse["dre"] = null;
  let aviso: string | null = null;

  if (semNatureza.size > 0) {
    aviso = `${semNatureza.size} conta(s) sem natureza definida (${[...semNatureza].slice(0, 5).join(", ")}${semNatureza.size > 5 ? "…" : ""}). Forneça o plano de contas (coluna "natureza" ou código padrão) para gerar BP e DRE.`;
  } else {
    const saldoPositivo = (n: NaturezaConta) => balancete.filter((b) => b.natureza === n).map((b) => ({ conta: b.conta, valor: Math.abs(Number(b.saldo)) }));
    const total = (arr: { valor: number }[]) => round2(arr.reduce((s, x) => s + x.valor, 0));

    const ativo = saldoPositivo("ativo");
    const passivo = saldoPositivo("passivo");
    const pl = saldoPositivo("pl");
    const receitas = saldoPositivo("receita");
    const custos = saldoPositivo("custo");
    const despesas = saldoPositivo("despesa");

    const totalReceitas = total(receitas);
    const totalCustos = total(custos);
    const totalDespesas = total(despesas);
    const resultado = round2(totalReceitas - totalCustos - totalDespesas);
    const totalAtivo = total(ativo);
    const totalPassivo = total(passivo);
    const totalPL = total(pl);
    const fecha = Math.abs(totalAtivo - (totalPassivo + totalPL + resultado)) < 0.01;

    const cv = (arr: { conta: string; valor: number }[]) => arr.map((x) => ({ conta: x.conta, valor: x.valor.toFixed(2) }));
    bp = { ativo: cv(ativo), passivo: cv(passivo), pl: cv(pl), totalAtivo: totalAtivo.toFixed(2), totalPassivo: totalPassivo.toFixed(2), totalPL: totalPL.toFixed(2), resultado: resultado.toFixed(2), fecha };
    dre = { receitas: cv(receitas), custos: cv(custos), despesas: cv(despesas), totalReceitas: totalReceitas.toFixed(2), totalCustos: totalCustos.toFixed(2), totalDespesas: totalDespesas.toFixed(2), resultado: resultado.toFixed(2) };
  }

  return {
    balancete,
    totalDebitos: totDeb.toFixed(2),
    totalCreditos: totCred.toFixed(2),
    partidaDobradaOk,
    divergencias,
    bp,
    dre,
    resumo: "",
    aviso,
  };
}

function vazia(aviso: string): ContabilResponse {
  return { balancete: [], totalDebitos: "0.00", totalCreditos: "0.00", partidaDobradaOk: false, divergencias: [{ descricao: aviso, valor: null }], bp: null, dre: null, resumo: "", aviso };
}
