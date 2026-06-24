/**
 * Parse DETERMINÍSTICO da NF-e (XML → NotaFiscal) + validações de consistência.
 *
 * §2: tudo aqui vem do XML, nunca de LLM. Usa fast-xml-parser (robusto a namespaces).
 * As validações (achados) são checagens aritméticas/de formato sobre os dados extraídos.
 */
import { XMLParser } from "fast-xml-parser";
import type { AchadoFiscal, ItemNota, NotaFiscal } from "../contracts";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true, // tolera <nfe:nNF> e afins
  parseTagValue: false, // mantém valores como string (preserva "1250.00")
});

function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v).trim();
}

function dec(v: unknown): string {
  const n = Number(txt(v));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export function parseNfe(xml: string): { nota: NotaFiscal; achados: AchadoFiscal[] } {
  const raiz = parser.parse(xml) as Record<string, unknown>;
  // Aceita <nfeProc><NFe>…, <NFe>… ou já o <infNFe>.
  const proc = (raiz.nfeProc ?? raiz) as Record<string, unknown>;
  const nfe = ((proc.NFe ?? proc) as Record<string, unknown>);
  const inf = (nfe.infNFe ?? (proc as Record<string, unknown>).infNFe) as Record<string, unknown> | undefined;
  if (!inf) throw new Error("XML não parece uma NF-e (não achei infNFe).");

  const ide = (inf.ide ?? {}) as Record<string, unknown>;
  const emit = (inf.emit ?? {}) as Record<string, unknown>;
  const dest = (inf.dest ?? {}) as Record<string, unknown>;
  const total = ((inf.total as Record<string, unknown>)?.ICMSTot ?? {}) as Record<string, unknown>;

  const detRaw = inf.det;
  const dets = (Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : []) as Record<string, unknown>[];
  const itens: ItemNota[] = dets.map((d) => {
    const p = (d.prod ?? {}) as Record<string, unknown>;
    return {
      codigo: txt(p.cProd),
      descricao: txt(p.xProd),
      quantidade: txt(p.qCom),
      valorUnitario: dec(p.vUnCom),
      valorTotal: dec(p.vProd),
    };
  });

  const chave = soDigitos(txt(inf["@_Id"])); // "NFe3520..." → só os 44 dígitos

  const nota: NotaFiscal = {
    numero: txt(ide.nNF),
    serie: txt(ide.serie),
    dataEmissao: txt(ide.dhEmi || ide.dEmi),
    naturezaOperacao: txt(ide.natOp),
    chaveAcesso: chave,
    emitente: { documento: soDigitos(txt(emit.CNPJ || emit.CPF)), nome: txt(emit.xNome) },
    destinatario: { documento: soDigitos(txt(dest.CNPJ || dest.CPF)), nome: txt(dest.xNome) },
    itens,
    valorProdutos: dec(total.vProd),
    valorFrete: dec(total.vFrete),
    valorICMS: dec(total.vICMS),
    valorTotal: dec(total.vNF),
  };

  return { nota, achados: validar(nota) };
}

// Validações determinísticas — checagens sobre os dados já extraídos do XML.
function validar(n: NotaFiscal): AchadoFiscal[] {
  const achados: AchadoFiscal[] = [];

  const somaItens = n.itens.reduce((s, i) => s + Number(i.valorTotal), 0);
  if (n.itens.length && Math.abs(somaItens - Number(n.valorProdutos)) > 0.01) {
    achados.push({
      tipo: "divergencia_total",
      descricao: `Soma dos itens (R$ ${somaItens.toFixed(2)}) ≠ total de produtos da nota (R$ ${n.valorProdutos}).`,
      severidade: "alta",
    });
  }
  if (soDigitos(n.emitente.documento).length !== 14) {
    achados.push({ tipo: "cnpj_emitente", descricao: "CNPJ do emitente ausente ou com formato inválido (esperado 14 dígitos).", severidade: "media" });
  }
  if (n.chaveAcesso.length !== 44) {
    achados.push({ tipo: "chave_acesso", descricao: `Chave de acesso com ${n.chaveAcesso.length} dígitos (esperado 44).`, severidade: "media" });
  }
  if (Number(n.valorTotal) <= 0) {
    achados.push({ tipo: "valor_total", descricao: "Valor total da nota (vNF) é zero ou inválido.", severidade: "alta" });
  }
  if (!n.itens.length) {
    achados.push({ tipo: "sem_itens", descricao: "Nenhum item (det) encontrado na nota.", severidade: "alta" });
  }
  return achados;
}
