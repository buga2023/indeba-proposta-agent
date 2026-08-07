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

// ── Marcação das respostas ────────────────────────────────────────────────────
// As respostas saíam daqui como parágrafo corrido e a bolha do chat as imprimia cruas
// (`whiteSpace: pre-wrap`): título de ficha, rótulo de campo e item de lista chegavam na
// tela com o MESMO peso de 13px. Num balão de 372px, "Linha: X Funções: y, z Uso: ..."
// vira massa cinzenta — a informação está lá e ninguém acha.
//
// Convenção mínima, lida por `formatar()` em ajuda-chat.tsx. De propósito NÃO é Markdown
// completo: é o subconjunto que este chat usa, sem dependência nova e sem HTML de terceiro
// no meio de texto que fala de preço.
//
//   **negrito**     → destaque inline (rótulo, nome de produto, número que importa)
//   linha só de **…** → vira título do bloco
//   "• " no começo  → item de lista, com recuo pendurado (a 2ª linha alinha com a 1ª)
//   "N. " no começo → item numerado (passo a passo)
//   linha vazia     → separa blocos
//
// Manter o texto como string (e não como objeto/JSX) é o que preserva o cérebro
// determinístico testável: tests/unit/ajuda-chat.test.ts continua casando por conteúdo.
const L = (...linhas: string[]) => linhas.join("\n");

type QA = { kw: string[]; q: string; a: string };
// ORDEM IMPORTA: o casamento é o PRIMEIRO item cuja palavra aparece no texto. As entradas
// antigas abrem com termos larguíssimos ("como", "usar", "criar"), que engoliriam qualquer
// pergunta nova — por isso as três de 01/08/2026 entram no topo, com palavras próprias.
export const FAQ: QA[] = [
  // Cadastro deixou de logar direto (a conta nasce pendente e o gestor libera). Sem esta
  // resposta a pessoa fica tentando redefinir uma senha que está certa — foi exatamente o
  // que o 403 do login passou a evitar na tela; aqui é a mesma explicação.
  {
    kw: ["acesso", "liberar", "libera", "aprova", "pendente", "aguardando", "cadastrei", "nao consigo entrar", "nao entra"],
    q: "Cadastrei e não consigo entrar. Por quê?",
    a: L(
      "Sua conta foi criada — o que falta é a liberação do gestor. **A senha está certa**: quem se cadastra entra numa fila de aprovação em vez de entrar direto no sistema.",
      "",
      "**Como destravar:**",
      "1. O gestor abre **Configurações** e vê a fila de aprovação",
      "2. Ele libera o seu acesso por lá",
      "3. Você entra normalmente, com o mesmo e-mail e senha",
    ),
  },
  // Escopo por autor (01/08/2026): o vendedor vê a própria carteira. Sem explicação, "sumiu
  // proposta" vira chamado de bug — e não é bug, é o recorte novo.
  {
    kw: ["minhas propostas", "so vejo", "sumiu", "sumiram", "dos outros", "do colega", "carteira", "time inteiro"],
    q: "Por que só vejo as minhas propostas?",
    a: L(
      "O histórico mostra a **sua carteira**: cada vendedor vê as propostas que ele mesmo criou. **Nada foi apagado** — as dos colegas continuam lá, só não aparecem para você. Quem enxerga o time inteiro é o gestor.",
      "",
      "**Não achou uma proposta sua?** Ela pode estar arquivada — marque \"ver arquivadas\" no histórico.",
    ),
  },
  {
    kw: ["sob consulta", "cotar", "cotacao", "orcar"],
    q: "Por que o produto aparece \"sob consulta\"?",
    a: L(
      "Porque o catálogo **não guarda preço** — quem cota é você, na montagem da proposta.",
      "",
      "• **No catálogo:** ficha técnica, foto, linha e embalagens",
      "• **Na montagem:** o valor que você cota, que vai para o PDF e para o total",
    ),
  },
  {
    kw: ["o que faz", "o que e", "serve", "para que"],
    q: "O que esse agente faz?",
    a: L(
      "Gera **propostas comerciais em PDF** no padrão Indeba a partir do catálogo real: você monta os itens e o PDF sai pronto para enviar.",
      "",
      "**De onde vem cada coisa:**",
      "• **Do catálogo** — ficha técnica, foto e embalagens (nunca da IA)",
      "• **De você** — o preço cotado e as quantidades",
      "• **Da IA** — só o texto de apresentação, que você revisa antes de exportar",
    ),
  },
  {
    kw: ["como", "gerar", "gero", "passo", "criar", "estruturad", "ja sei", "manual"],
    q: "Como eu gero uma proposta?",
    a: L(
      "Dois caminhos:",
      "",
      "1. **Manual** — informe o cliente, busque os produtos no catálogo e ajuste as quantidades você mesmo",
      "2. **Importar orçamento** — suba um PDF de orçamento existente; o sistema extrai cliente e itens e casa cada um com o catálogo (o que não casar aparece para você conferir)",
      "",
      "Nos dois casos o final é o mesmo: revise o texto e os itens na tela de revisão e baixe o PDF.",
    ),
  },
  {
    kw: ["tipo", "orcament", "implanta", "comercial", "solucao", "consolidad"],
    q: "Quais tipos de proposta existem?",
    a: L(
      "Ao criar uma proposta nova, hoje só o modelo **\"Proposta de Solução\"** está disponível — 1 página rica por produto, que é o padrão atual.",
      "",
      "Os modelos antigos (Orçamento, Implantação, Comercial) continuam existindo **só para propostas geradas antes**: elas abrem e exportam normalmente.",
    ),
  },
  {
    kw: ["edita", "editar", "mudar", "muda", "revis", "ajust", "altera"],
    q: "Posso mudar os produtos e o texto antes de exportar?",
    a: L(
      "Sim. Na **tela de revisão** dá para:",
      "",
      "• Incluir ou remover produtos",
      "• Ajustar a quantidade de cada item",
      "• Pedir um refino do texto por IA",
      "",
      "O PDF reflete exatamente o que você deixar lá.",
    ),
  },
  {
    kw: ["usar"],
    q: "Como eu uso o agente?",
    a: L(
      "Comece em **\"Nova proposta\"** e escolha o caminho:",
      "",
      "• **Manual** — montar os itens você mesmo",
      "• **Importar orçamento** — subir um PDF existente",
      "",
      "Depois é só revisar o resultado e baixar o PDF.",
    ),
  },
  // A resposta antiga dizia que "boa parte do catálogo está fora da seleção até ser
  // precificada". Isso descrevia o MVP de 9 produtos e ficou errado duas vezes em
  // 01/08/2026: o catálogo real inteiro entrou no ar (os 141 escondidos eram bug de dado,
  // não falta de preço) e preço deixou de morar no catálogo. Mandava o vendedor esperar por
  // algo que não ia acontecer.
  {
    kw: ["nao faz", "limitac", "mvp", "falta"],
    q: "O que esse agente ainda não faz?",
    a: L(
      "**Ainda não dá para:**",
      "• Enviar a proposta por e-mail pelo sistema — o PDF é baixado e enviado por você",
      "• Cadastrar produto novo pela tela — o catálogo é atualizado fora do sistema",
      "",
      "E eu respondo sobre o catálogo e o uso do agente. Fora disso, prefiro dizer que não sei a inventar.",
    ),
  },
];

export const WELCOME = L(
  "**Oi! Sou o assistente do Indeba Express PRO IA.**",
  "",
  "Posso te ajudar com:",
  "• **Catálogo** — ficha técnica, linha e embalagens de cada produto",
  "• **Propostas** — como montar, manualmente ou importando um orçamento",
  "• **Acesso** — liberação de conta e por que você vê só a sua carteira",
  "",
  "Pergunta o que quiser ou toque numa sugestão 👇",
);
export const SUGESTOES = ["Ver todos os produtos", "Como gero uma proposta?", "Produtos para cozinha", "Por que só vejo as minhas propostas?", "Cadastrei e não consigo entrar"];
export const NAO_SEI = L(
  "Sobre isso eu não sei te responder — e prefiro não inventar. 🤷",
  "",
  "**O que eu sei:**",
  "• Os produtos do catálogo — ficha técnica, linha e embalagens",
  "• Como montar, revisar e exportar uma proposta",
  "• Acesso, liberação de conta e o escopo da sua carteira",
  "",
  "Tenta pelo nome de um produto, ou por uma necessidade — ex.: \"algo para desengordurar louça\".",
);

export function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
// Catálogo pode estar sem preço (valor vem do orçamento importado) — não inventa.
export function preco(p: string | null): string {
  return p ? "R$ " + p.replace(".", ",") : "sob consulta";
}
// Linha de lista: o NOME é o que a pessoa procura, então é ele que fica em negrito e na
// frente. O preço saiu da abertura (ficava `Nome (sob consulta) —`, um parêntese idêntico
// em todas as linhas separando o nome do que o descreve) e foi para o fim, onde não atrapalha
// a varredura vertical dos nomes.
function fichaCurta(p: Produto): string {
  const e = p.embalagens[0];
  return `**${p.nome}** — ${FUNCAO_LABEL[p.funcoes[0]] ?? p.funcoes[0]} · ${e.tamanho} ${e.unidade} · ${preco(e.preco)}`;
}

// Ficha completa: título, resumo, campos rotulados e a tabela de embalagens — cada bloco
// separado. Antes eram sete linhas seguidas no mesmo peso, com "Linha:", "Funções:" e "Uso:"
// competindo com os próprios valores.
function fichaCompleta(p: Produto): string {
  return L(
    `**📦 ${p.nome}**`,
    p.descricaoCurta,
    "",
    `**Linha:** ${LINHA_LABEL[p.linha] ?? p.linha}`,
    `**Funções:** ${p.funcoes.map((f) => FUNCAO_LABEL[f] ?? f).join(", ")}`,
    `**Uso:** ${p.descricaoUso}`,
    "",
    "**Embalagens:**",
    ...p.embalagens.map((e) => {
      const extra = [e.diluicaoMax ? `diluição até ${e.diluicaoMax}` : "", e.custoDiluido ? `custo diluído ${preco(e.custoDiluido)}/L` : ""].filter(Boolean).join(" · ");
      return `• **${e.tamanho} ${e.unidade}** — ${preco(e.preco)}${extra ? ` (${extra})` : ""}`;
    }),
  );
}

// "Ver todos os produtos" — a primeira sugestão do assistente — nasceu com 9 produtos no
// ar. Com o catálogo real (147 ativos) a MESMA resposta virou uma parede de 147 linhas
// dentro de um balão de chat, e como preço saiu do catálogo, todas terminam iguais em "sob
// consulta": rolar aquilo não responde nada. O resumo por linha cabe na tela e devolve a
// pergunta útil — por necessidade ou por nome, que é onde a ficha completa aparece.
const CATALOGO_CURTO = 12;
function catalogoEmResumo(ativos: Produto[]): string {
  if (ativos.length <= CATALOGO_CURTO) {
    return L(`**${ativos.length} produtos no catálogo:**`, "", ...ativos.map((p) => `• ${fichaCurta(p)}`));
  }
  const porLinha = new Map<string, number>();
  for (const p of ativos) porLinha.set(p.linha, (porLinha.get(p.linha) ?? 0) + 1);
  const linhas = [...porLinha.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([l, n]) => `• **${LINHA_LABEL[l] ?? l}** — ${n} ${n === 1 ? "produto" : "produtos"}`);
  return L(
    `**${ativos.length} produtos no catálogo**, distribuídos por linha:`,
    "",
    ...linhas,
    "",
    'Me diz o que você precisa (ex.: "algo para desengordurar louça") ou o nome do produto, que eu abro a ficha completa.',
  );
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
    // Preço de um produto citado: era tudo numa linha só, separado por "·" — com 4
    // embalagens estourava a bolha e quebrava em qualquer ponto. Uma embalagem por linha.
    if (achado) {
      return querPreco
        ? L(`**${achado.nome}** — preço por embalagem:`, "", ...achado.embalagens.map((e) => `• **${e.tamanho} ${e.unidade}** — ${preco(e.preco)}`))
        : fichaCompleta(achado);
    }
  }

  // 2) Listar todos / todos os preços (preço genérico sem necessidade específica)
  if (querTodos || (querPreco && !temKw)) {
    if (!produtos) return "Só um instante, ainda estou carregando o catálogo…";
    // "Quais os preços?" (genérico, sem produto citado) tem resposta melhor que a lista:
    // o catálogo não guarda mais preço. Dizer isso é honesto e resolve; despejar o catálogo
    // inteiro com "sob consulta" em toda linha só faz a pessoa procurar o que não está lá.
    if (querPreco && !querTodos && ativos.length && ativos.every((p) => !p.embalagens[0]?.preco)) {
      return L(
        "O catálogo **não guarda preço** — quem cota é você, na montagem da proposta.",
        "",
        "• **Aqui eu mostro:** ficha técnica, linha e embalagens de cada produto",
        "• **Você define na montagem:** o valor, que vai para o PDF e para o total",
        "",
        "Me diz o nome do produto que eu abro a ficha.",
      );
    }
    return catalogoEmResumo(ativos);
  }

  // 3) Necessidade (função/linha/segmento) → produtos que casam
  const filtros = KW.filter((k) => k.kw.some((w) => t.includes(w))).map((k) => k.filtro);
  if (filtros.length) {
    if (!produtos) return "Só um instante, ainda estou carregando o catálogo…";
    const casam = ativos.filter((p) => filtros.some((f) => (f.campo === "linha" ? p.linha === f.valor : (p[f.campo] as string[]).includes(f.valor))));
    const rotulos = [...new Set(filtros.map((f) => f.rotulo))].join(", ");
    if (casam.length) {
      return L(
        `**Para ${rotulos}** — ${casam.length} ${casam.length === 1 ? "produto" : "produtos"}:`,
        "",
        ...casam.map((p) => `• ${fichaCurta(p)}`),
      );
    }
    return L(
      `Não temos nenhum produto no catálogo para **${rotulos}**.`,
      "",
      'Posso mostrar o que existe — é só perguntar "ver todos os produtos".',
    );
  }

  // 4) FAQ (como usar / tipos / etc.)
  const faq = FAQ.find((f) => f.kw.some((w) => t.includes(w)));
  if (faq) return faq.a;

  // 5) Não sei — NÃO inventa (instrução do usuário)
  return null;
}
