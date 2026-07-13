// Interpretação do chat de correção da proposta (Revisão). Mesma forma do roteador
// financeiro (src/lib/financeiro/llm.ts::rotear): a IA só CLASSIFICA a ação e resolve
// o item/campo alvo — nunca decide um valor numérico (preço/quantidade). Esse número
// vem sempre de regex determinístico sobre a mensagem original (proposta-edit.ts,
// extrairNumero), aplicado pelo chamador — não por aqui.
import { ComandoEdicao } from "../contracts";
import { gerarJson } from "./ollama";
import { sanitizarEntrada } from "./sanitizar";

const SCHEMA = {
  type: "object",
  properties: {
    acao: {
      type: "string",
      enum: [
        "alterar_razao_social",
        "alterar_cnpj",
        "alterar_segmento",
        "alterar_responsavel_cliente",
        "alterar_quantidade_item",
        "remover_item",
        "adicionar_item_catalogo",
        "alterar_preco_item",
        "alterar_condicao_comercial",
        "limitar_orcamento",
        "selecionar_por_necessidade",
        "nao_entendi",
      ],
    },
    valorTexto: { type: ["string", "null"] },
    codigoItem: { type: ["string", "null"] },
    campoCondicao: { type: ["string", "null"], enum: ["validade", "prazoEntrega", "pagamento", "frete", null] },
  },
  required: ["acao", "valorTexto", "codigoItem", "campoCondicao"],
};

const FALLBACK: ComandoEdicao = { acao: "nao_entendi", valorTexto: null, codigoItem: null, campoCondicao: null };

function prompt(mensagem: string, itensProposta: { codigo: string; nome: string }[], itensCatalogo: { codigo: string; nome: string }[]): string {
  const msg = sanitizarEntrada(mensagem);
  return `Você é o interpretador de comandos de um chat de correção de proposta comercial. NÃO responda a mensagem — apenas classifique a AÇÃO pedida e resolva o alvo, devolvendo SOMENTE um JSON válido.

Ações possíveis:
- "alterar_razao_social" / "alterar_cnpj" / "alterar_segmento" / "alterar_responsavel_cliente": trocar um dado do cliente. Em "valorTexto", coloque o NOVO valor exatamente como o vendedor escreveu.
- "alterar_quantidade_item": mudar a quantidade de um item já na proposta. Resolva "codigoItem" comparando o produto citado com a lista de itens da proposta abaixo. NÃO coloque o número em "valorTexto" — deixe null.
- "remover_item": tirar um item da proposta. Resolva "codigoItem" do mesmo jeito.
- "adicionar_item_catalogo": incluir um produto do CATÁLOGO que ainda não está na proposta. Resolva "codigoItem" comparando com a lista do catálogo abaixo.
- "alterar_preco_item": mudar o preço de um item já na proposta. Resolva "codigoItem". NÃO coloque o número em "valorTexto" — deixe null.
- "alterar_condicao_comercial": mudar validade/prazo de entrega/pagamento/frete. Em "campoCondicao" use exatamente um de: validade, prazoEntrega, pagamento, frete. Em "valorTexto", o novo texto da condição.
- "limitar_orcamento": o vendedor quer que o TOTAL da proposta não passe de um valor (ex.: "não deixe passar de R$800", "remove o produto menos importante pra caber no orçamento"). NÃO coloque o número em "valorTexto" — deixe null.
- "selecionar_por_necessidade": o vendedor pede pra (re)montar a proposta com os melhores produtos do catálogo pra uma necessidade/assunto (ex.: "escolha os melhores produtos pra higienização de cozinha", "monte um orçamento de desinfecção"), com ou sem teto de valor junto. Em "valorTexto", coloque a necessidade descrita em texto livre (ex.: "higienização de cozinha") — NUNCA um número.
- "nao_entendi": a mensagem não é uma correção clara, ou você não conseguiu resolver o item citado — use isso em vez de chutar.

NUNCA escreva um número (preço/quantidade) em "valorTexto" — isso é sempre extraído do texto original por outra parte do sistema, não por você.

Itens já na proposta (código — nome): ${itensProposta.map((i) => `${i.codigo} — ${i.nome}`).join("; ") || "(nenhum)"}
Produtos do catálogo (código — nome), só relevante para "adicionar_item_catalogo": ${itensCatalogo.map((i) => `${i.codigo} — ${i.nome}`).join("; ")}

Mensagem do vendedor: """${msg}"""

Responda APENAS com o JSON, sem texto antes ou depois.`;
}

// Loop de Reparo (mesmo padrão de financeiro/llm.ts::rotear): se o JSON não validar,
// reenvia com o erro anexado. Erro/timeout/JSON inválido após as tentativas → "nao_entendi"
// (nunca lança, nunca aplica uma correção que a IA não conseguiu classificar direito).
export async function interpretarComando(
  mensagem: string,
  itensProposta: { codigo: string; nome: string }[],
  itensCatalogo: { codigo: string; nome: string }[],
  tentativas = 2,
): Promise<ComandoEdicao> {
  let p = prompt(mensagem, itensProposta, itensCatalogo);
  for (let i = 0; i < tentativas; i++) {
    try {
      const bruto = await gerarJson(p, SCHEMA, 60_000, 0);
      const limpo = bruto.replace(/```json|```/g, "").trim();
      const obj = JSON.parse(limpo);
      const parsed = ComandoEdicao.safeParse(obj);
      if (parsed.success) return parsed.data;
      p += `\n\nSeu último retorno não validou: ${JSON.stringify(parsed.error.issues)}. Devolva SÓ o JSON válido.`;
    } catch (e) {
      p += `\n\nSeu último retorno não era JSON: ${e instanceof Error ? e.message : e}. Devolva SÓ o JSON válido.`;
    }
  }
  return FALLBACK;
}
