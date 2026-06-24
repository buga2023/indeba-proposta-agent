/**
 * Parser determinístico de NF-e (modelo 55, XML). Extrai número, partes, itens e o
 * total autoritativo (vNF) e converte para a Tabela do motor — assim o relatório roda
 * sobre a verdade fiscal, não sobre planilha digitada. Sem LLM (§2).
 */
import { XMLParser } from "fast-xml-parser";
import { NotaFiscal, ItemNfe, type NotaFiscal as TNota } from "../contracts/nfe";
import type { Tabela } from "./ingest";

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// dhEmi ("2026-03-24T09:00:00-03:00") ou dEmi ("2026-03-24") → "2026-03-24".
function dataEmissao(v: unknown): string | null {
  const s = txt(v);
  return s ? s.slice(0, 10) : null;
}

// Extrai infNFe sob qualquer invólucro comum (nfeProc/NFe).
function acharInfNFe(doc: Record<string, unknown>): Record<string, unknown> | null {
  const proc = doc?.["nfeProc"] as Record<string, unknown> | undefined;
  const nfe = (proc?.["NFe"] ?? doc?.["NFe"]) as Record<string, unknown> | undefined;
  return (nfe?.["infNFe"] as Record<string, unknown> | undefined) ?? null;
}

export function parseNfe(xml: string): TNota {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const inf = acharInfNFe(doc);
  if (!inf) throw new Error("XML não parece uma NF-e (infNFe ausente).");

  const ide = (inf["ide"] ?? {}) as Record<string, unknown>;
  const emit = (inf["emit"] ?? {}) as Record<string, unknown>;
  const dest = (inf["dest"] ?? {}) as Record<string, unknown>;
  const detRaw = inf["det"];
  const dets = (Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : []) as Array<Record<string, unknown>>;

  const itens = dets.map((d) => {
    const prod = (d["prod"] ?? {}) as Record<string, unknown>;
    return ItemNfe.parse({
      codigo: txt(prod["cProd"]) ?? "",
      descricao: txt(prod["xProd"]) ?? "",
      ncm: txt(prod["NCM"]),
      quantidade: Number(txt(prod["qCom"]) ?? "0"),
      valorUnitario: txt(prod["vUnCom"]) ?? "0",
      valorTotal: txt(prod["vProd"]) ?? "0",
    });
  });

  const total = ((inf["total"] as Record<string, unknown>)?.["ICMSTot"] ?? {}) as Record<string, unknown>;
  const somaItens = itens.reduce((a, it) => a + Number(it.valorTotal), 0).toFixed(2);

  return NotaFiscal.parse({
    numero: txt(ide["nNF"]) ?? "",
    serie: txt(ide["serie"]),
    dataEmissao: dataEmissao(ide["dhEmi"] ?? ide["dEmi"]),
    emitente: { documento: txt(emit["CNPJ"]), nome: txt(emit["xNome"]) },
    destinatario: { documento: txt(dest["CNPJ"]) ?? txt(dest["CPF"]), nome: txt(dest["xNome"]) },
    itens,
    valorTotal: txt(total["vNF"]) ?? somaItens, // vNF é autoritativo; cai na soma se ausente
  });
}

// Notas → Tabela do motor: 1 linha por nota, valor_total = vNF. O relatório/totalizar
// então calculam o faturamento sobre a verdade fiscal.
export function nfesParaTabela(notas: TNota[]): Tabela {
  const colunas = ["numero", "data", "emitente", "destinatario", "valor_total"];
  const numericas = new Set(["valor_total"]);
  const linhas = notas.map((n) => ({
    numero: n.numero,
    data: n.dataEmissao ?? "",
    emitente: n.emitente.nome ?? "",
    destinatario: n.destinatario.nome ?? "",
    valor_total: Number(n.valorTotal),
  }));
  return { colunas, numericas, linhas };
}
