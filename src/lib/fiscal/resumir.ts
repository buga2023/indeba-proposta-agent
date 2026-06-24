/**
 * Resumo da NF-e em linguagem natural (IA-TEXTO). A IA recebe os dados JÁ extraídos e os
 * achados JÁ calculados — só explica, não recalcula imposto nem inventa valor (§2). Sem
 * Ollama, devolve um resumo determinístico dos achados.
 */
import type { AchadoFiscal, NotaFiscal } from "../contracts";
import { gerarTexto, ollamaDisponivel } from "../llm/ollama";

function resumoFixo(nota: NotaFiscal, achados: AchadoFiscal[]): string {
  const cab = `NF-e ${nota.numero} (série ${nota.serie}) — ${nota.emitente.nome} → ${nota.destinatario.nome}. ${nota.itens.length} item(ns), total R$ ${nota.valorTotal}.`;
  if (!achados.length) return `${cab} Sem inconsistências detectadas nas validações automáticas.`;
  return `${cab}\nPontos de atenção:\n` + achados.map((a) => `- [${a.severidade}] ${a.descricao}`).join("\n");
}

export async function resumirNota(nota: NotaFiscal, achados: AchadoFiscal[]): Promise<string> {
  if (!(await ollamaDisponivel())) return resumoFixo(nota, achados);

  const lista = achados.length ? achados.map((a) => `- [${a.severidade}] ${a.descricao}`).join("\n") : "(nenhum)";
  const prompt = `Você é um assistente fiscal. Resuma esta NF-e em português claro e aponte os riscos. NÃO recalcule nada nem invente valores — use só os dados abaixo. Termine lembrando que não substitui o contador.

Nota: nº ${nota.numero}, série ${nota.serie}, emissão ${nota.dataEmissao}, natureza "${nota.naturezaOperacao}".
Emitente: ${nota.emitente.nome} (${nota.emitente.documento}). Destinatário: ${nota.destinatario.nome} (${nota.destinatario.documento}).
Itens: ${nota.itens.length}. Produtos: R$ ${nota.valorProdutos}, frete R$ ${nota.valorFrete}, ICMS R$ ${nota.valorICMS}, TOTAL R$ ${nota.valorTotal}.
Achados das validações automáticas:
${lista}

Resumo:`;
  try {
    const t = (await gerarTexto(prompt)).trim();
    return t || resumoFixo(nota, achados);
  } catch {
    return resumoFixo(nota, achados);
  }
}
