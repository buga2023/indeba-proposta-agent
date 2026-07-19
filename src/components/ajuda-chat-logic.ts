// Cérebro DETERMINÍSTICO do assistente de ajuda (sem React, sem IA). Aterrado no
// catálogo: preço/ficha vêm sempre dos dados reais (constituição §1.2). REGRA:
// responde só o que sabe; sem casamento → retorna null (o chamador diz "não sei").
// Separado do componente para ser testável (tests/unit/ajuda-chat.test.ts).

import type { Produto } from "@/lib/contracts";

export const LINHA_LABEL: Record<string, string> = {
  alimentos_bebidas: "Alimentos & Bebidas",
  limpeza_conservacao: "Limpeza & Conservação",
  higiene_pessoal: "Higiene Pessoal",
  higiene_clinica: "Higiene Clínica",
  lavanderia: "Lavanderia",
  tratamento_pisos: "Tratamento de Pisos",
  automotiva: "Automotiva",
};
export const FUNCAO_LABEL: Record<string, string> = {
  desengordurante: "desengordurante",
  desinfetante: "desinfetante",
  desincrustante: "desincrustante",
  sabonete: "sabonete",
  antisseptico: "antisséptico",
  multiuso: "multiuso",
  cip: "CIP (circulação)",
};

// Palavras do vendedor → faceta real do catálogo (mesmo espírito do matcher do agente).
type Filtro = { campo: "linha" | "funcoes" | "segmentos"; valor: string; rotulo: string };
const KW: { kw: string[]; filtro: Filtro }[] = [
  { kw: ["desengordur", "gordura", "louc", "detergente"], filtro: { campo: "funcoes", valor: "desengordurante", rotulo: "desengordurante" } },
  { kw: ["desinfet", "sanitiz", "clor", "quaternar"], filtro: { campo: "funcoes", valor: "desinfetante", rotulo: "desinfetante" } },
  { kw: ["desincrust", "incrust", "carboniz"], filtro: { campo: "funcoes", valor: "desincrustante", rotulo: "desincrustante" } },
  { kw: ["sabonete"], filtro: { campo: "funcoes", valor: "sabonete", rotulo: "sabonete" } },
  { kw: ["antissep", "alcool", "gel"], filtro: { campo: "funcoes", valor: "antisseptico", rotulo: "antisséptico" } },
  { kw: ["multiuso", "uso geral"], filtro: { campo: "funcoes", valor: "multiuso", rotulo: "multiuso" } },
  { kw: ["laticin", "leite", "queijo"], filtro: { campo: "segmentos", valor: "laticinio", rotulo: "laticínio" } },
  { kw: ["cozinha", "restaurante", "refeitor"], filtro: { campo: "segmentos", valor: "cozinha_industrial", rotulo: "cozinha industrial" } },
  { kw: ["mao", "higiene pessoal"], filtro: { campo: "linha", valor: "higiene_pessoal", rotulo: "higiene pessoal" } },
  { kw: ["aliment", "bebida"], filtro: { campo: "linha", valor: "alimentos_bebidas", rotulo: "alimentos & bebidas" } },
  { kw: ["limpeza", "conserva", "superfic", "ambiente"], filtro: { campo: "linha", valor: "limpeza_conservacao", rotulo: "limpeza & conservação" } },
];

type QA = { kw: string[]; q: string; a: string };
export const FAQ: QA[] = [
  { kw: ["o que faz", "o que e", "serve", "para que"], q: "O que esse agente faz?", a: "Gera propostas comerciais em PDF no padrão Indeba a partir do catálogo real: você monta os itens (direto ou importando um orçamento) e o PDF sai pronto para enviar. Preço, ficha técnica e foto vêm sempre do catálogo — nunca da IA." },
  { kw: ["como", "gerar", "gero", "passo", "criar", "estruturad", "ja sei", "manual"], q: "Como eu gero uma proposta?", a: "Dois caminhos: 1) Manual — informe o cliente, busque os produtos no catálogo e ajuste as quantidades você mesmo. 2) Importar orçamento — suba um PDF de orçamento existente; o sistema extrai cliente e itens e casa cada um com o catálogo (o que não casar aparece pra você conferir). Nos dois casos: revise o texto e os itens na tela de revisão e baixe o PDF." },
  { kw: ["tipo", "orcament", "implanta", "comercial", "solucao", "consolidad"], q: "Quais tipos de proposta existem?", a: "Hoje, ao criar uma proposta nova, só o modelo \"Proposta de Solução\" está disponível (1 página rica por produto, padrão atual). Os modelos antigos (Orçamento, Implantação, Comercial) continuam existindo só para propostas já geradas antes." },
  { kw: ["edita", "editar", "mudar", "muda", "revis", "ajust", "altera"], q: "Posso mudar os produtos e o texto antes de exportar?", a: "Sim. Na tela de revisão dá pra incluir/remover produtos, ajustar quantidade e pedir um refino do texto por IA. O PDF reflete exatamente o que você deixar lá." },
  { kw: ["usar"], q: "Como eu uso o agente?", a: "Comece em \"Nova proposta\": escolha Manual (montar os itens você mesmo) ou Importar orçamento (subir um PDF existente). Revise o resultado e baixe o PDF." },
  { kw: ["nao faz", "limitac", "mvp", "falta"], q: "O que esse agente ainda não faz?", a: "Boa parte do catálogo (produtos arquivados) ainda não tem preço cadastrado, então fica fora da seleção até ser precificada. Envio automático da proposta por e-mail também não está ativo — o PDF é baixado manualmente." },
];

export const WELCOME = "Oi! Sou o assistente da Plataforma de IA da Indeba. Conheço os produtos do catálogo (ficha e preço) e sei como montar propostas — manualmente ou importando um orçamento em PDF. Pergunta o que quiser ou toque numa sugestão 👇";
export const SUGESTOES = ["Ver todos os produtos", "Como gero uma proposta?", "Quais tipos de proposta?", "Produtos para cozinha", "Posso editar antes de exportar?"];
export const NAO_SEI = "Sobre isso eu não sei te responder — e prefiro não inventar. 🤷 O que eu sei: os produtos do catálogo (ficha técnica e preço) e como usar o agente de proposta. Tenta perguntar sobre um produto, uma necessidade (ex.: \"algo para desengordurar louça\") ou toque numa sugestão.";

export function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
// Catálogo pode estar sem preço (valor vem do orçamento importado) — não inventa.
export function preco(p: string | null): string {
  return p ? "R$ " + p.replace(".", ",") : "sob consulta";
}
function fichaCurta(p: Produto): string {
  const e = p.embalagens[0];
  return `${p.nome} (${preco(e.preco)}) — ${FUNCAO_LABEL[p.funcoes[0]] ?? p.funcoes[0]} · ${e.tamanho} ${e.unidade}`;
}
function fichaCompleta(p: Produto): string {
  return [
    `📦 ${p.nome}`,
    p.descricaoCurta,
    `Linha: ${LINHA_LABEL[p.linha] ?? p.linha}`,
    `Funções: ${p.funcoes.map((f) => FUNCAO_LABEL[f] ?? f).join(", ")}`,
    `Uso: ${p.descricaoUso}`,
    ...p.embalagens.map((e) => {
      const extra = [e.diluicaoMax ? `diluição até ${e.diluicaoMax}` : "", e.custoDiluido ? `custo diluído ${preco(e.custoDiluido)}/L` : ""].filter(Boolean).join(" · ");
      return `• ${e.tamanho} ${e.unidade}: ${preco(e.preco)}${extra ? ` (${extra})` : ""}`;
    }),
  ].join("\n");
}

// Resolve a pergunta SÓ com dados do catálogo/FAQ. null = não sabe (não inventa).
export function responder(texto: string, produtos: Produto[] | null): string | null {
  const t = norm(texto);
  const ativos = (produtos ?? []).filter((p) => p.ativo);

  const querPreco = /(prec|quanto custa|quanto e|valor|custo|quanto sai)/.test(t);
  const querTodos = /(todos|lista|catalog|quais produto|que produto|tem quais)/.test(t);
  const temKw = KW.some((k) => k.kw.some((w) => t.includes(w)));

  // 1) Nome/código de produto citado → ficha completa (ou só preço)
  if (ativos.length) {
    const achado = ativos.find((p) => {
      const n = norm(p.nome);
      const ult = norm(p.nome.split(" ").slice(-1)[0]);
      return t.includes(n) || t.includes(norm(p.codigo)) || (ult.length >= 3 && new RegExp(`\\b${ult}\\b`).test(t));
    });
    if (achado) return querPreco ? `${achado.nome}: ${achado.embalagens.map((e) => `${e.tamanho} ${e.unidade} ${preco(e.preco)}`).join(" · ")}` : fichaCompleta(achado);
  }

  // 2) Listar todos / todos os preços (preço genérico sem necessidade específica)
  if (querTodos || (querPreco && !temKw)) {
    if (!produtos) return "Só um instante, ainda estou carregando o catálogo…";
    return `Temos ${ativos.length} produtos no catálogo:\n${ativos.map((p) => `• ${fichaCurta(p)}`).join("\n")}`;
  }

  // 3) Necessidade (função/linha/segmento) → produtos que casam
  const filtros = KW.filter((k) => k.kw.some((w) => t.includes(w))).map((k) => k.filtro);
  if (filtros.length) {
    if (!produtos) return "Só um instante, ainda estou carregando o catálogo…";
    const casam = ativos.filter((p) => filtros.some((f) => (f.campo === "linha" ? p.linha === f.valor : (p[f.campo] as string[]).includes(f.valor))));
    const rotulos = [...new Set(filtros.map((f) => f.rotulo))].join(", ");
    if (casam.length) return `Para ${rotulos}, temos:\n${casam.map((p) => `• ${fichaCurta(p)}`).join("\n")}`;
    return `Não temos nenhum produto no catálogo para ${rotulos}. Posso mostrar o que existe — pergunta "ver todos os produtos".`;
  }

  // 4) FAQ (como usar / tipos / etc.)
  const faq = FAQ.find((f) => f.kw.some((w) => t.includes(w)));
  if (faq) return faq.a;

  // 5) Não sei — NÃO inventa (instrução do usuário)
  return null;
}
