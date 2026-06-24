/**
 * Motor de comparação de cotações DETERMINÍSTICO.
 *
 * §2: nada vem de LLM. Por linha (cotação de um fornecedor): custoTotal = preço×qtd + frete;
 * custoEfetivo traz isso a valor presente pelo prazo de pagamento (prazo maior = melhor,
 * pois você paga depois). Ranqueia por custo efetivo e mede a economia da melhor escolha.
 */
import type { Cotacao } from "../contracts";
import type { Tabela } from "../financeiro/ingest";

export type ResultadoCompras = {
  cotacoes: Cotacao[];
  melhorFornecedor: string;
  economia: string;
  aviso: string | null;
};

function colObj(t: Tabela, re: RegExp): string | undefined {
  return t.colunas.find((c) => !t.numericas.has(c) && re.test(c));
}
function colNum(t: Tabela, re: RegExp): string | undefined {
  return t.colunas.find((c) => t.numericas.has(c) && re.test(c));
}
function num(linha: Record<string, string | number>, col: string | undefined, padrao = 0): number {
  if (!col) return padrao;
  const v = linha[col];
  return typeof v === "number" ? v : padrao;
}

export function compararCotacoes(t: Tabela, taxaMensal = 0.02): ResultadoCompras {
  const vazio = (aviso: string): ResultadoCompras => ({ cotacoes: [], melhorFornecedor: "", economia: "0.00", aviso });

  const colForn = colObj(t, /fornecedor|forn|empresa|raz|nome/) ?? colObj(t, /.*/);
  const colPreco = colNum(t, /preco|pre[çc]o|valor|unit/) ?? [...t.numericas][0];
  if (!colForn) return vazio("Não encontrei a coluna de FORNECEDOR.");
  if (!colPreco) return vazio("Não encontrei a coluna de PREÇO.");

  const colItem = colObj(t, /item|produto|descri|material/);
  const colQtd = colNum(t, /qtd|quant/);
  const colFrete = colNum(t, /frete|entrega/);
  const colPrazo = colNum(t, /prazo|dias|pagamento/);

  const cotacoes: Cotacao[] = t.linhas.map((r) => {
    const preco = num(r, colPreco);
    const qtd = num(r, colQtd, 1) || 1;
    const frete = num(r, colFrete, 0);
    const prazoDias = Math.round(num(r, colPrazo, 0));
    const custoTotal = preco * qtd + frete;
    // Valor presente: paga em `prazoDias` → vale menos hoje. prazo 0 → custoEfetivo = custoTotal.
    const custoEfetivo = custoTotal / (1 + taxaMensal * (prazoDias / 30));
    return {
      fornecedor: String(r[colForn] ?? "—").trim() || "—",
      item: colItem ? String(r[colItem] ?? "") || null : null,
      precoUnitario: preco.toFixed(2),
      quantidade: qtd,
      frete: frete.toFixed(2),
      prazoDias,
      custoTotal: custoTotal.toFixed(2),
      custoEfetivo: custoEfetivo.toFixed(2),
    };
  });

  cotacoes.sort((a, b) => Number(a.custoEfetivo) - Number(b.custoEfetivo));

  const economia =
    cotacoes.length >= 2
      ? (Number(cotacoes[1].custoEfetivo) - Number(cotacoes[0].custoEfetivo)).toFixed(2)
      : "0.00";

  const aviso = !colQtd && !colFrete && !colPrazo
    ? "Usei só o preço (não achei quantidade/frete/prazo). Inclua-os para a comparação ficar completa."
    : null;

  return { cotacoes, melhorFornecedor: cotacoes[0]?.fornecedor ?? "", economia, aviso };
}
