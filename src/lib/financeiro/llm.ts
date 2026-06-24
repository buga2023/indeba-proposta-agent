/**
 * Camada de LINGUAGEM do agente financeiro (porta `src/llm.py`).
 *
 * Faz só duas coisas, reaproveitando o cliente Ollama do projeto:
 *   1. rotear()     -> classifica a intenção e extrai parâmetros (JSON validado por Zod)
 *   2. verbalizar() -> explica em PT um resultado JÁ CALCULADO pelo motor
 *
 * NUNCA calcula, soma ou inventa número — os valores entram prontos do motor (§2).
 */
import { Roteamento } from "../contracts";
import { gerarJson, gerarTexto } from "../llm/ollama";

// JSON Schema entregue ao Ollama (saída restrita). Espelha o contrato Roteamento.
const ROTA_SCHEMA = {
  type: "object",
  properties: {
    intencao: {
      type: "string",
      enum: [
        "consultar_dado",
        "consolidar",
        "bater_resultados",
        "calcular_imposto",
        "duvida_tributaria",
        "conversa",
      ],
    },
    metrica: { type: ["string", "null"], enum: ["soma", "media", "contagem", "max", "min", null] },
    coluna_valor: { type: ["string", "null"] },
    agrupar_por: { type: ["string", "null"] },
    filtros: { type: ["object", "null"] },
    fonte_a: { type: ["string", "null"] },
    fonte_b: { type: ["string", "null"] },
    chave: { type: ["string", "null"] },
    imposto: { type: ["string", "null"] },
    regime: { type: ["string", "null"] },
  },
  required: ["intencao"],
};

function promptRoteador(pergunta: string, colunas: string[], planilhas: string[]): string {
  return `Você é o ROTEADOR de um agente financeiro. NÃO responda a pergunta nem faça contas.
Apenas classifique a intenção e extraia parâmetros, devolvendo SOMENTE um JSON válido.

Intenções:
- "consultar_dado": somar/contar/média/máx/mín sobre a planilha (ex.: "quanto vendi em janeiro?", "total por categoria")
- "consolidar": juntar várias planilhas numa só
- "bater_resultados": conciliar duas fontes e achar divergências (ex.: "bate o extrato com as notas")
- "calcular_imposto": aplicar uma alíquota sobre uma base (ex.: "calcule ICMS no presumido sobre 10000")
- "duvida_tributaria": dúvida conceitual sobre tributos (ex.: "o que é Simples Nacional?")
- "conversa": saudação ou fora de escopo

Em "metrica" use exatamente um de: soma, media, contagem, max, min (ou null).
Em "agrupar_por", "coluna_valor", "chave" use EXATAMENTE um dos nomes de coluna abaixo (ou null).

Colunas da planilha atual: ${colunas.join(", ") || "(nenhuma)"}
Planilhas carregadas: ${planilhas.join(", ") || "(nenhuma)"}

Pergunta: ${pergunta}

Responda APENAS com o JSON, sem texto antes ou depois.`;
}

const ROTA_FALLBACK: Roteamento = {
  intencao: "conversa",
  metrica: null,
  coluna_valor: null,
  agrupar_por: null,
  filtros: null,
  fonte_a: null,
  fonte_b: null,
  chave: null,
  imposto: null,
  regime: null,
};

export async function rotear(
  pergunta: string,
  colunas: string[],
  planilhas: string[],
  tentativas = 2,
): Promise<Roteamento> {
  let prompt = promptRoteador(pergunta, colunas, planilhas);
  for (let i = 0; i < tentativas; i++) {
    // Loop de Reparo: se o JSON não validar no Zod, devolve o erro e pede de novo.
    const bruto = await gerarJson(prompt, ROTA_SCHEMA, 60_000, 0);
    const limpo = bruto.replace(/```json|```/g, "").trim();
    try {
      const obj = JSON.parse(limpo);
      const parsed = Roteamento.safeParse(obj);
      if (parsed.success) return parsed.data;
      prompt += `\n\nSeu último retorno não validou: ${JSON.stringify(parsed.error.issues)}. Devolva SÓ o JSON válido.`;
    } catch (e) {
      prompt += `\n\nSeu último retorno não era JSON: ${e instanceof Error ? e.message : e}. Devolva SÓ o JSON válido.`;
    }
  }
  return ROTA_FALLBACK;
}

export async function verbalizar(pergunta: string, resumoNumerico: string): Promise<string> {
  const prompt = `Você é um assistente financeiro. Abaixo está um RESULTADO já calculado por um motor determinístico.
Os números abaixo são a VERDADE ABSOLUTA: não recalcule, não arredonde diferente, não invente nada.
Apenas explique em português claro e direto, respondendo à pergunta. Mantenha todos os valores exatamente como estão.

Pergunta: ${pergunta}

Resultado calculado:
${resumoNumerico}

Resposta:`;
  return (await gerarTexto(prompt)).trim();
}

export async function conversar(pergunta: string): Promise<string> {
  const prompt = `Você é um assistente financeiro objetivo, responde em português. Em dúvidas tributárias conceituais, explique de forma geral e lembre que alíquotas e enquadramentos específicos devem ser confirmados com o contador. Nunca afirme alíquotas exatas como se fossem definitivas.

Pergunta: ${pergunta}

Resposta:`;
  return (await gerarTexto(prompt)).trim();
}
