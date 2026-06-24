/**
 * Análise de contrato recebido.
 *
 * O motor (regex DETERMINÍSTICO sobre o texto) extrai os achados — multa, prazo, rescisão,
 * reajuste, foro, valores, vigência — e o `trecho` é SEMPRE literal do contrato. A IA (§1)
 * só EXPLICA os achados em linguagem simples (procedência IA-TEXTO); sem Ollama, devolve um
 * resumo determinístico. O modelo nunca extrai número nem inventa cláusula (§2).
 */
import type { Achado, ContratoAnalise, TipoAchado } from "../contracts";
import { gerarTexto, ollamaDisponivel } from "../llm/ollama";
import { sanitizarEntrada } from "../llm/sanitizar";

// Recorta um trecho legível em volta do match (contexto da cláusula).
function trechoEmVolta(texto: string, idx: number, len: number): string {
  const ini = Math.max(0, idx - 60);
  const fim = Math.min(texto.length, idx + len + 60);
  return texto.slice(ini, fim).replace(/\s+/g, " ").trim();
}

type Regra = {
  tipo: TipoAchado;
  re: RegExp;
  valorDe: (m: RegExpExecArray) => string | null;
  severidade: (m: RegExpExecArray) => Achado["severidade"];
};

const REGRAS: Regra[] = [
  {
    tipo: "multa",
    re: /multa\s+(?:de\s+|equivalente\s+a\s+)?(\d{1,3}(?:[.,]\d+)?\s*%)/gi,
    valorDe: (m) => m[1].replace(/\s+/g, ""),
    // Multa alta (≥10%) merece destaque.
    severidade: (m) => (parseFloat(m[1].replace(",", ".")) >= 10 ? "alta" : "media"),
  },
  {
    tipo: "rescisao",
    re: /rescis[ãa]o\s+unilateral|resilir\s+unilateralmente|den[úu]ncia\s+imotivada/gi,
    valorDe: () => null,
    severidade: () => "alta",
  },
  {
    tipo: "reajuste",
    re: /(reajust\w+|corre[çc][ãa]o\s+monet[áa]ria)[^.\n]{0,80}?(IGP-?M|IPCA|INPC)/gi,
    valorDe: (m) => m[2].toUpperCase(),
    severidade: () => "media",
  },
  {
    tipo: "foro",
    re: /foro\s+da\s+comarca\s+de\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s/-]{2,40})/gi,
    valorDe: (m) => m[1].trim(),
    severidade: () => "baixa",
  },
  {
    tipo: "vigencia",
    re: /vig[êe]ncia\s+(?:de\s+)?(\d+\s*(?:meses|m[êe]s|anos|ano|dias|dia))/gi,
    valorDe: (m) => m[1].replace(/\s+/g, " "),
    severidade: () => "baixa",
  },
  {
    tipo: "prazo",
    re: /prazo[^.\n]{0,40}?(\d+\s*(?:dias|dia|meses|m[êe]s|anos|ano))/gi,
    valorDe: (m) => m[1].replace(/\s+/g, " "),
    severidade: () => "baixa",
  },
  {
    tipo: "valor",
    re: /R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi,
    valorDe: (m) => m[0].replace(/\s+/g, " "),
    severidade: () => "baixa",
  },
];

const ORDEM: Record<Achado["severidade"], number> = { alta: 0, media: 1, baixa: 2 };

export function extrairAchados(texto: string): Achado[] {
  const achados: Achado[] = [];
  const vistos = new Set<string>();
  for (const regra of REGRAS) {
    regra.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regra.re.exec(texto)) !== null) {
      const trecho = trechoEmVolta(texto, m.index, m[0].length);
      const chave = `${regra.tipo}:${trecho}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      achados.push({
        tipo: regra.tipo,
        trecho,
        valor: regra.valorDe(m),
        severidade: regra.severidade(m),
      });
      if (regra.re.lastIndex === m.index) regra.re.lastIndex++; // anti-loop em match vazio
    }
  }
  return achados.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade]);
}

function resumoDeterministico(achados: Achado[]): string {
  if (!achados.length) return "Não encontrei cláusulas de risco evidentes (multa, rescisão, reajuste, foro). Revise manualmente mesmo assim.";
  const altas = achados.filter((a) => a.severidade === "alta");
  const partes = achados.map((a) => `- ${a.tipo}${a.valor ? ` (${a.valor})` : ""}`);
  return `Encontrei ${achados.length} ponto(s) de atenção${altas.length ? `, ${altas.length} de alta severidade` : ""}:\n${partes.join("\n")}`;
}

export async function analisarContrato(texto: string): Promise<ContratoAnalise> {
  const achados = extrairAchados(texto);

  if (!achados.length || !(await ollamaDisponivel())) {
    return { achados, explicacao: resumoDeterministico(achados) };
  }

  const lista = achados
    .map(
      (a) =>
        `- [${a.severidade}] ${a.tipo}${a.valor ? ` = ${sanitizarEntrada(a.valor, 120)}` : ""}: "${sanitizarEntrada(a.trecho, 200)}"`,
    )
    .join("\n");
  const prompt = `Você é um assistente jurídico. Abaixo estão ACHADOS extraídos automaticamente de um contrato (a verdade — não invente outros nem mude valores). Explique em português simples, para um empresário leigo, o RISCO de cada ponto e o que observar. Seja direto e termine lembrando que isto não substitui um advogado.

Achados:
${lista}

Explicação:`;
  try {
    const explicacao = await gerarTexto(prompt);
    return { achados, explicacao: explicacao.trim() || resumoDeterministico(achados) };
  } catch {
    return { achados, explicacao: resumoDeterministico(achados) };
  }
}
