/**
 * Adapter: NF-e (já parseada) → Tabela do motor. 1 linha por nota, valor_total = vNF —
 * assim o relatório/totalizar rodam sobre a verdade fiscal, não sobre planilha digitada.
 *
 * O PARSE do XML é ÚNICO e mora em ../fiscal/parse.ts (parser canônico, com validações).
 * Aqui NÃO se duplica a extração (§5: estender, não bifurcar) — só converte para a Tabela.
 */
import type { NotaFiscal } from "../contracts/fiscal";
import type { Tabela } from "./ingest";

// Notas → Tabela do motor: 1 linha por nota, valor_total = vNF (autoritativo do XML).
export function nfesParaTabela(notas: NotaFiscal[]): Tabela {
  const colunas = ["numero", "data", "emitente", "destinatario", "valor_total"];
  const numericas = new Set(["valor_total"]);
  const linhas = notas.map((n) => ({
    numero: n.numero,
    data: (n.dataEmissao ?? "").slice(0, 10), // dhEmi "2026-…T…" → só a data
    emitente: n.emitente.nome,
    destinatario: n.destinatario.nome,
    valor_total: Number(n.valorTotal),
  }));
  return { colunas, numericas, linhas };
}
