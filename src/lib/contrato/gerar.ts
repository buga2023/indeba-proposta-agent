/**
 * Geração de contrato a partir do PropostaScope (handoff Proposta → Contrato).
 *
 * O esqueleto é 100% determinístico (cópia do escopo/catálogo) — partes, itens, valor e
 * condições. A IA só REDIGE o texto das cláusulas (procedência IA-TEXTO); se o Ollama
 * estiver fora, cai num modelo de cláusulas FIXO (degradação graciosa, §5). Nenhum número
 * é tocado pelo modelo: as cláusulas só referenciam os valores que o motor já fixou (§2).
 */
import type { Clausula, ContratoScope, ParteContrato } from "../contracts";
import type { PropostaScope } from "../contracts";
import { gerarJson, ollamaDisponivel } from "../llm/ollama";

// Fornecedor (Indeba). Nome da marca é dado conhecido do projeto; CNPJ/endereço não estão
// no escopo, então saem como "[preencher]" — sinaliza a lacuna, não inventa dado legal (§2).
const CONTRATADA: Record<PropostaScope["template"], ParteContrato> = {
  indeba: { razaoSocial: "Indeba", cnpj: "[preencher]", endereco: "[preencher]" },
  indeba_express: { razaoSocial: "Indeba Express", cnpj: "[preencher]", endereco: "[preencher]" },
};

/** Σ (preço da 1ª embalagem × quantidade) — mesma convenção determinística do log.ts. */
function calcularItens(proposta: PropostaScope) {
  let total = 0;
  const itens = proposta.itens.map((i) => {
    const qtd = i.quantidade ?? 1;
    const precoUnitario = i.embalagens[0]?.preco ?? "0.00";
    const subtotal = (Number(precoUnitario) || 0) * qtd;
    total += subtotal;
    return {
      codigo: i.codigo,
      nome: i.nome,
      quantidade: qtd,
      precoUnitario,
      subtotal: subtotal.toFixed(2),
    };
  });
  return { itens, valorTotal: total.toFixed(2) };
}

const CLAUSULAS_SCHEMA = {
  type: "object",
  properties: {
    clausulas: {
      type: "array",
      items: {
        type: "object",
        properties: { titulo: { type: "string" }, texto: { type: "string" } },
        required: ["titulo", "texto"],
      },
    },
  },
  required: ["clausulas"],
};

function promptClausulas(scope: ContratoScope): string {
  const itens = scope.itens.map((i) => `${i.quantidade}× ${i.nome} (cód. ${i.codigo})`).join("; ");
  return `Você é um assistente jurídico. Redija as CLÁUSULAS de um contrato de fornecimento de produtos, em português formal e claro.

NÃO altere, recalcule nem invente nenhum número, valor, prazo ou nome — use EXATAMENTE os dados abaixo onde forem citados.

CONTRATADA (fornecedora): ${scope.contratada.razaoSocial}
CONTRATANTE (cliente): ${scope.contratante.razaoSocial} (CNPJ ${scope.contratante.cnpj})
Objeto: ${scope.objeto}
Itens: ${itens}
Valor total: R$ ${scope.valorTotal}
Prazo de entrega: ${scope.condicoes.prazoEntrega}
Pagamento: ${scope.condicoes.pagamento}
Frete: ${scope.condicoes.frete}
Validade da proposta: ${scope.condicoes.validade}

Gere cláusulas padrão de um contrato de fornecimento: Do Objeto, Do Preço e Pagamento, Do Prazo e Entrega, Das Obrigações da Contratada, Das Obrigações da Contratante, Da Rescisão, Do Foro. Cada uma com título curto e texto objetivo. Responda APENAS o JSON pedido.`;
}

// Cláusulas FIXAS (fallback sem IA): referenciam os mesmos campos determinísticos.
function clausulasFixas(scope: ContratoScope): Clausula[] {
  const f = (titulo: string, texto: string): Clausula => ({ titulo, texto, procedencia: "MODELO-FIXO" });
  return [
    f("Do Objeto", `O presente contrato tem por objeto ${scope.objeto}.`),
    f(
      "Do Preço e Pagamento",
      `O valor total do fornecimento é de R$ ${scope.valorTotal}, a ser pago conforme: ${scope.condicoes.pagamento}.`,
    ),
    f("Do Prazo e Entrega", `A entrega observará o prazo de ${scope.condicoes.prazoEntrega}. Frete: ${scope.condicoes.frete}.`),
    f("Das Obrigações da Contratada", "A CONTRATADA obriga-se a fornecer os produtos nas especificações e quantidades pactuadas, dentro do prazo estabelecido."),
    f("Das Obrigações da Contratante", "A CONTRATANTE obriga-se a efetuar o pagamento nas condições acordadas e a receber os produtos no prazo combinado."),
    f("Da Rescisão", "O contrato poderá ser rescindido por descumprimento de qualquer cláusula, mediante notificação prévia, sem prejuízo das perdas e danos."),
    f("Do Foro", "Fica eleito o foro da comarca da CONTRATADA para dirimir quaisquer questões oriundas deste contrato."),
  ];
}

export async function gerarContrato(proposta: PropostaScope): Promise<ContratoScope> {
  const { itens, valorTotal } = calcularItens(proposta);
  const objeto = `o fornecimento, pela CONTRATADA à CONTRATANTE, de ${itens.length} ${itens.length === 1 ? "item" : "itens"} de produtos do catálogo Indeba`;

  const scope: ContratoScope = {
    id: crypto.randomUUID(),
    criadoEm: new Date().toISOString(),
    origemPropostaId: proposta.id,
    contratada: CONTRATADA[proposta.template],
    contratante: {
      razaoSocial: proposta.cliente.razaoSocial,
      cnpj: proposta.cliente.cnpj ?? "[preencher]",
      endereco: "[preencher]",
    },
    objeto,
    itens,
    valorTotal,
    condicoes: proposta.condicoesComerciais,
    clausulas: [], // preenchido abaixo (IA ou fixo)
  };

  // A IA só redige o texto das cláusulas. Falha/indisponibilidade → modelo fixo.
  if (await ollamaDisponivel()) {
    try {
      const bruto = await gerarJson(promptClausulas(scope), CLAUSULAS_SCHEMA, 60_000, 0.2);
      const parsed = JSON.parse(bruto.replace(/```json|```/g, "").trim()) as {
        clausulas?: { titulo?: string; texto?: string }[];
      };
      const clausulas = (parsed.clausulas ?? [])
        .filter((c) => c.titulo && c.texto)
        .map((c): Clausula => ({ titulo: c.titulo!, texto: c.texto!, procedencia: "IA-TEXTO" }));
      scope.clausulas = clausulas.length ? clausulas : clausulasFixas(scope);
    } catch {
      scope.clausulas = clausulasFixas(scope);
    }
  } else {
    scope.clausulas = clausulasFixas(scope);
  }

  return scope;
}
