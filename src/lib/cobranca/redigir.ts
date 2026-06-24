/**
 * Régua de cobrança escrita pela IA — porém SÓ 3 templates (leve/média/grave) com
 * placeholders {cliente}/{valor}/{dias}. O motor substitui os valores reais (§2: a IA
 * nunca vê nem emite número). Sem Ollama, cai num modelo fixo (degradação graciosa, §5).
 */
import { gerarJson, ollamaDisponivel } from "../llm/ollama";

export type ReguaTemplates = { leve: string; media: string; grave: string };

const FIXOS: ReguaTemplates = {
  leve: "Olá, {cliente}! Notamos que há um valor de {valor} em aberto, vencido há {dias} dias. Pode ter passado despercebido — conseguimos regularizar? Qualquer dúvida, estamos à disposição.",
  media: "Olá, {cliente}. Consta em nosso sistema um débito de {valor}, com {dias} dias de atraso. Pedimos a gentileza de regularizar o quanto antes para evitar encargos. Podemos ajudar com a forma de pagamento?",
  grave: "Prezado(a) {cliente}, o débito de {valor} está com {dias} dias de atraso. Solicitamos a regularização imediata para evitarmos medidas adicionais de cobrança. Entre em contato para negociarmos uma solução.",
};

const SCHEMA = {
  type: "object",
  properties: {
    leve: { type: "string" },
    media: { type: "string" },
    grave: { type: "string" },
  },
  required: ["leve", "media", "grave"],
};

export async function gerarRegua(empresa = "Indeba"): Promise<ReguaTemplates> {
  if (!(await ollamaDisponivel())) return FIXOS;
  const prompt = `Você escreve mensagens de cobrança para a empresa "${empresa}". Gere 3 templates de mensagem (WhatsApp/e-mail), em português, em tom ESCALONADO:
- "leve": cordial, assume esquecimento (1º aviso).
- "media": firme e educado, pede regularização e oferece ajuda.
- "grave": formal e enérgico, atraso longo, menciona medidas de cobrança sem ser ofensivo.

REGRA: use EXATAMENTE os placeholders {cliente}, {valor} e {dias} onde fizer sentido — NÃO escreva valores reais, NÃO invente número. Cada mensagem curta (3-5 linhas). Responda só o JSON.`;
  try {
    const bruto = await gerarJson(prompt, SCHEMA, 60_000, 0.4);
    const o = JSON.parse(bruto.replace(/```json|```/g, "").trim()) as Partial<ReguaTemplates>;
    return {
      leve: o.leve || FIXOS.leve,
      media: o.media || FIXOS.media,
      grave: o.grave || FIXOS.grave,
    };
  } catch {
    return FIXOS;
  }
}
