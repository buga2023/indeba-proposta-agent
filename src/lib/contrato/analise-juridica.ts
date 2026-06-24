/**
 * Orquestrador da análise de contrato — junta as peças determinísticas e deixa a IA
 * só EXPLICAR (não decidir cobertura).
 *
 * Fluxo: texto → checklist (cobertura garantida pelo código) → lacunas ancoradas na norma
 * oficial → a IA comenta por que cada lacuna importa. §2: o "presente/ausente" e a norma
 * vêm de código; o LLM só escreve a explicação. §6: triagem revisável, não parecer.
 */
import { rodarChecklist, lacunas, type ItemChecklist } from "./checklist";
import { ancorar, type ItemAncorado } from "./fundamentos";
import { gerarJson, ollamaDisponivel } from "../llm/ollama";

export type AnaliseJuridica = {
  itens: ItemChecklist[]; // todas as categorias varridas (cobertura)
  lacunas: ItemAncorado<ItemChecklist>[]; // ausentes, por severidade, ancoradas na norma
  cobertura: { total: number; presentes: number; ausentes: number };
  explicacao: string | null; // IA-TEXTO; null se IA off ou não solicitada
  aviso: string;
};

export const AVISO_ANALISE =
  "Triagem automática, NÃO é parecer jurídico — revise com advogado. A cobertura (o que falta) " +
  "é garantida pelo checklist determinístico; o texto explicativo é da IA e deve ser conferido.";

const SCHEMA = {
  type: "object",
  properties: { explicacao: { type: "string" } },
  required: ["explicacao"],
};

function prompt(faltando: ItemAncorado<ItemChecklist>[]): string {
  const lista = faltando
    .map((l) => `- ${l.nome} (severidade ${l.severidade}${l.referencia ? `, base: ${l.referencia.lei}` : ""}): ${l.oQueOlhar}`)
    .join("\n");
  return `Você é um assistente jurídico de TRIAGEM (não dá parecer). As cláusulas abaixo estão AUSENTES do contrato (verificado por checklist determinístico). Escreva um parágrafo curto em PT-BR explicando, no geral, por que vale revisar essas lacunas com um advogado. NÃO invente artigos nem afirme obrigatoriedade — apenas oriente. Responda APENAS o JSON pedido.

LACUNAS (já detectadas pelo sistema, são DADO):
${lista}`;
}

export async function analisarJuridico(
  texto: string,
  opts: { comIA?: boolean } = {},
): Promise<AnaliseJuridica> {
  const itens = rodarChecklist(texto);
  const faltando = ancorar(lacunas(itens));
  const cobertura = {
    total: itens.length,
    presentes: itens.filter((i) => i.presente).length,
    ausentes: faltando.length,
  };

  let explicacao: string | null = null;
  if (opts.comIA && faltando.length > 0 && (await ollamaDisponivel())) {
    const cru = await gerarJson(prompt(faltando), SCHEMA);
    explicacao = (JSON.parse(cru) as { explicacao?: string }).explicacao ?? null;
  }

  return { itens, lacunas: faltando, cobertura, explicacao, aviso: AVISO_ANALISE };
}
