import type { PropostaItem, PropostaScope } from "../contracts";
import { consolidadaDefaults } from "../consolidada-defaults";
import { custoLitroDiluido } from "../diluicao";
import { linhaDoSegmento, segmentosLegiveis } from "../segmento";
import { chaveImagem, imagemEhIlustrativa } from "../imagem-produto";
import { tamanhoLegivel } from "../embalagem";

export const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const brl = (v: string) =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rendimento vem do catálogo como texto livre: às vezes um valor curto ("Até 100 litros de
// solução pronta"), às vezes VÁRIAS dosagens em uma linha só separadas por ";" — ex.: Sanquat:
// "0,4% p/v (manutenção diária); 0,5-1% p/v (botas em pedilúvios); ...". O destaque grande
// (.p-big, laranja/negrito/centralizado) só cabe no valor curto; jogado sobre o texto longo
// vira um paredão laranja que estoura o card. Aqui: curto e único → destaque; multi-dosagem →
// lista legível (a dose em destaque, o contexto entre parênteses em cinza abaixo).
export const fmtRendimento = (raw: string): string => {
  const r = String(raw ?? "").trim();
  const partes = r.split(/;\s*/).map((s) => s.trim()).filter(Boolean);
  if (partes.length === 1 && r.length <= 46) return `<div class="pp-big">${esc(r)}</div>`;
  return `<ul class="pp-rlist">${partes
    .map((p) => {
      const m = p.match(/^(.+?)\s*\((.+)\)\.?$/); // "valor (contexto)" → separa dose e contexto
      return m
        ? `<li><b>${esc(m[1])}</b><span>${esc(m[2])}</span></li>`
        : `<li><span>${esc(p)}</span></li>`;
    })
    .join("")}</ul>`;
};

const NAVY = "#0b2a4a";
const ORANGE = "#e8622a";

// Margem inferior do PDF (mm) para a Consolidada: ZERO. A faixa branca no pé de
// TODA página ("todas as páginas estão com esse recorte", áudio do Matheus 24/07)
// era a margem inferior do page.pdf (15mm) onde o Chromium desenhava o rodapé de
// paginação: o fundo colorido (capa cinza, rail navy, onda) parava ali e o
// documento ficava com um degrau branco na borda. Com margem 0 o desenho sangra
// até a borda da página; a paginação passa a ser desenhada DENTRO do HTML
// (.pgnum), o que só é possível porque cada seção é garantidamente 1 página
// (altura fixa + overflow hidden) e o total é conhecido (totalPaginas()).
export const MARGEM_INFERIOR_CONSOLIDADA = 0;
const ALTURA_PAGINA = `${297 - MARGEM_INFERIOR_CONSOLIDADA}mm`; // A4 297mm, margem superior 0

// capa + apresentação + comodatos + 1 página por produto + condições comerciais.
export const totalPaginas = (qtdItens: number) => qtdItens + 4;

// Set de ícones inline (traço navy). Chave desconhecida → ponto genérico. Usados
// em "indicado para", cards, comodatos e condições. Paths simples, estilo linha.
const ICONES: Record<string, string> = {
  cozinha: '<path d="M7 2v6M12 2v6M17 2v6M4 8h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M9 15v7M15 15v7"/>',
  restaurante: '<path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
  hotel: '<path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6"/>',
  padaria: '<path d="M4 13a8 4 0 0 1 16 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  churrascaria: '<path d="M12 2v8M8 6h8M5 14h14l-2 7H7z"/>',
  selo: '<circle cx="12" cy="9" r="6"/><path d="M9 14l-2 8 5-3 5 3-2-8"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  entrega: '<path d="M1 7h13v10H1zM14 10h5l3 3v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  suporte: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="4" height="6" rx="1"/><rect x="18" y="14" width="4" height="6" rx="1"/>',
  dispenser: '<rect x="8" y="2" width="8" height="20" rx="2"/><path d="M10 18h4"/>',
  toalheiro: '<rect x="4" y="6" width="16" height="6" rx="2"/><path d="M8 12v6M16 12v6"/>',
  aromatizador: '<rect x="8" y="6" width="8" height="16" rx="2"/><path d="M12 2v4M10 4h4"/>',
  lixeira: '<path d="M4 7h16M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  diluidor: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
  dosador: '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l3.5-3.5"/><circle cx="12" cy="16" r="1"/><path d="M2 20h20"/>',
  limpeza: '<path d="M8 10h7l1 11H7z"/><path d="M10 10V6h5"/><path d="M15 4v4"/><path d="M18 3v1M20.5 6h1M18 9v1"/>',
  contrato: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 14l2 2 3.5-4"/>',
  zap: '<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.3-5.3A8.5 8.5 0 1 1 21 11.5Z"/><path d="M9 9.5c.4 2.6 2.4 4.6 5 5"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7.5l9 6 9-6"/>',
  validade: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12l2 2 4-4"/>',
  prazo: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  pagamento: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  frete: '<path d="M1 7h13v10H1zM14 10h5l3 3v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
  "check-simples": '<path d="M6.5 12.5l3.5 3.5L17.5 8"/>',
  caixa: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  automotivo: '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
  piso: '<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>',
  etiqueta: '<path d="M20.5 12.5l-8 8L3 11V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  frasco: '<path d="M9 2h6M10 2v3.2L8 8v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-2.8V2"/><path d="M8 12.5h8"/>',
  saude: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M12 11v5M9.5 13.5h5"/>',
  predio: '<path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M8 7h2M8 11h2M8 15h2"/><path d="M3 21h18"/>',
  industria: '<path d="M3 21V11l5 3V11l5 3V7l6 4v10H3z"/><path d="M3 21h18M7 18v-1M11 18v-1M15 18v-1"/>',
  carrinho: '<circle cx="9" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/><path d="M2.5 4H5l2.2 10.5a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.78L20.5 8H6"/>',
  escola: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M6 10.5V15c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.5"/><path d="M22 8.2v4.3"/>',
  lavanderia: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13.5" r="4"/><path d="M8 6h.5M11 6h.5"/><path d="M9.7 13.5a2.3 2.3 0 0 1 2.3-2.3"/>',
  hortifruti: '<path d="M12 21c0-5 2-8 7-9-1 5-3 8-7 9z"/><path d="M12 21c0-4-1.5-6.5-6-7.5 1 4 2.5 6.5 6 7.5z"/><path d="M12 21v-7"/>',
};
export const iconeSvg = (nome: string, cor = NAVY): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome] ?? '<circle cx="12" cy="12" r="3"/>'}</svg>`;

// Contatos do rodapé da ficha e das condições (payload — ver ConsolidadaBloco.contato).
export type ContatoConsolidada = { whatsapp: string | null; emailConsultor: string | null };

// Paginação DENTRO da página (o rodapé nativo do Chromium exigia margem inferior,
// e essa margem era a faixa branca que cortava o fundo de toda página). Números
// vêm da própria montagem — cada seção é 1 página garantida (altura fixa).
const pgnum = (n: number, total: number) => `<div class="pgnum">Página ${n}/${total}</div>`;

// Uma página A4 rica por produto — rail navy (marca/foto/preço) + coluna de conteúdo
// (texto/specs). `numero` é só o número de página ("06"), nunca HTML pronto — o
// runmark "Proposta de Solução NN" é montado aqui, igual às outras seções (mesmo
// texto, só reposicionado). `simples`/`semVenda`: sinalizam o quão rica é a ficha
// (nenhum dado técnico/venda vs. só técnico) — o layout em rail já centraliza o
// conteúdo disponível sozinho, então essas classes hoje são só um sinal semântico.
export function paginaProduto(
  item: PropostaItem,
  dataUri: string,
  contato?: ContatoConsolidada,
  numero?: string,
  logoWhite?: string,
  siteUrl = "",
  totalPag?: number,
  segmento?: string | null,
): string {
  const f = item.ficha ?? null;
  const titulo = esc(item.nome); // nome comercial real — sempre bate com a ficha técnica em PDF (nunca a categoria de marketing)
  // Categoria (ficha.titulo) e subtítulo: quando o produto NÃO tem subtítulo cadastrado,
  // a categoria assume o lugar dele em LARANJA (.pp-sub) — era ela que aparecia cinza e
  // gerava o "às vezes o subtítulo não está em laranja" (pedido do CEO, ago/2026).
  const catTexto = f?.titulo && f.titulo !== item.nome ? f.titulo : "";
  const categoria = f?.subtitulo && catTexto ? `<div class="pp-eyebrow-cat">${esc(catTexto)}</div>` : "";
  const subtitulo = f?.subtitulo
    ? `<div class="pp-sub">${esc(f.subtitulo)}</div>`
    : catTexto
      ? `<div class="pp-sub">${esc(catTexto)}</div>`
      : "";
  // LINHA = o SEGMENTO do cliente, não mais o `ficha.linhaLabel` estático do produto.
  // O linhaLabel era fixo por produto e inconsistente (KITCHEN/AUTO/LAUNDRY, metade em
  // inglês): uma proposta de lavanderia saía com "LINHA KITCHEN" na ficha. Sem segmento
  // informado → sem eyebrow (nunca cai de volta no rótulo antigo) — spec Item 2.
  const linha = linhaDoSegmento(segmento);
  const eyebrow = linha ? `<div class="pp-eyebrow">LINHA<b>${esc(linha)}</b></div>` : "";
  const descricao = esc(f?.descricao || item.descricaoUso || "");
  // Embalagem cotada = SEMPRE embalagens[0] (convenção do app — ver a zona de Valor
  // mais abaixo). Todo dado de diluição desta página sai DELA.
  const cotada = item.embalagens[0];
  // Diluição: a ficha rica (indicadoPara/benefícios/características/rendimento) é dado de
  // catálogo que só existe pra alguns produtos (Primmax Plus/DGClor) — não inventamos pros
  // outros. Mas a EMBALAGEM já carrega diluicaoMax/custoDiluido pra vários produtos "simples"
  // (ex.: Primmax LDF, Primmax Hort) e o template não lia isso — dado real, só não estava sendo
  // usado aqui (é lido em template.ts pro modelo Express).
  // Só a COTADA vale: a montagem grava a diluição do consultor em embalagens[0] e deixa as
  // outras com o diluicaoMax do catálogo (page.tsx, `comDiluicao`). Um `find` pela primeira
  // embalagem com diluição pegava a de outro tamanho — o consultor marcava "não dilui" e o
  // painel continuava anunciando a diluição de catálogo do 20 L, contra o que ele informou.
  const diluicaoEmbalagem = cotada?.diluicaoMax ? cotada : null;
  const simples =
    !f?.indicadoPara?.length && !f?.beneficios?.length && !f?.diluicoes?.length && !diluicaoEmbalagem &&
    !f?.caracteristicas && !f?.rendimento && !f?.aplicacao && !f?.composicao;
  const semVenda = !simples && !f?.indicadoPara?.length && !f?.beneficios?.length;

  // Fichas MUITO longas (Primmax Sanap: 6 benefícios grandes + 7 finalidades de diluição)
  // não cabiam na página e o overflow:hidden cortava o último painel e o rodapé de contato.
  // O peso do texto decide um modo denso (tipografia/espaçamento mais justos) em vez de
  // cortar conteúdo. Limiar calibrado no catálogo inteiro: pega as 3 fichas mais pesadas,
  // que são exatamente as que chegavam perto do limite da página.
  const pesoFicha =
    (f?.descricao?.length ?? 0) +
    (f?.beneficios ?? []).reduce((s, b) => s + b.length, 0) +
    (f?.diluicoes ?? []).reduce((s, d) => s + d.uso.length + d.razao.length + (d.comoAplicar?.length ?? 0), 0) +
    (f?.rendimento?.length ?? 0) +
    // Aplicação e composição entram na conta: são dois parágrafos inteiros a mais, e sem
    // eles aqui o produto que os tem estouraria a página em vez de cair no modo denso.
    (f?.aplicacao?.length ?? 0) +
    (f?.composicao?.length ?? 0);
  const denso = pesoFicha > 1100;

  const indicado = f?.indicadoPara?.length
    ? `<div><div class="pp-label">Indicado para</div><div class="pp-icons">${f.indicadoPara
        .map((i) => `<div class="pp-ic"><span class="ic">${iconeSvg(i.icone)}</span><span>${esc(i.label)}</span></div>`)
        .join("")}</div></div>`
    : "";

  const beneficios = f?.beneficios?.length
    ? `<div><div class="pp-label">Principais benefícios</div><div class="pp-benes">${f.beneficios
        .map((b) => `<div class="pp-be"><span class="pp-chk">${iconeSvg("check-simples", "#fff")}</span><p>${esc(b)}</p></div>`)
        .join("")}</div></div>`
    : "";

  // Tabela "Modo de uso" (3 colunas) — só quando a ficha traz `comoAplicar` (dado real
  // extraído da ficha técnica). Sem isso, mantém o painel de 2 colunas de sempre.
  const temModoDeUso = f?.diluicoes?.some((d) => d.comoAplicar);
  const diluicoes = temModoDeUso
    ? ""
    : f?.diluicoes?.length
      ? `<div class="pp-panel"><h4>Modo de diluição</h4><div class="pp-rows">${f.diluicoes
          .map((d) => `<div class="pp-row"><span class="k">${esc(d.uso)}</span><span class="v">${esc(d.razao)}</span></div>`)
          .join("")}</div></div>`
      : diluicaoEmbalagem
        ? `<div class="pp-panel"><h4>Modo de diluição</h4><div class="pp-rows">
            <div class="pp-row"><span class="k">Diluição máxima</span><span class="v">${esc(diluicaoEmbalagem.diluicaoMax!)}</span></div>
            ${diluicaoEmbalagem.custoDiluido ? `<div class="pp-row"><span class="k">Custo/litro diluído</span><span class="v">${brl(diluicaoEmbalagem.custoDiluido)}</span></div>` : ""}
          </div></div>`
        : "";
  const modoUso = temModoDeUso
    ? `<div class="pp-panel pp-panel-modo"><h4>Modo de uso</h4><table class="pp-modo-tb">
        <thead><tr><th>Finalidade de uso</th><th>Diluição</th><th>Como aplicar</th></tr></thead>
        <tbody>${f!.diluicoes!
          .map((d) => `<tr><td>${esc(d.uso)}</td><td>${esc(d.razao)}</td><td>${esc(d.comoAplicar ?? "")}</td></tr>`)
          .join("")}</tbody>
      </table></div>`
    : "";
  const rendimento = f?.rendimento
    ? `<div class="pp-panel"><h4>Rendimento aproximado</h4>${fmtRendimento(f.rendimento)}</div>`
    : "";
  // Embalagem cotada = SEMPRE embalagens[0] (mesma convenção do resto do app —
  // preço/subtotal na revisão/dashboard também usam a primeira). "Disponíveis" lista
  // TODOS os tamanhos do produto (ficha técnica), incluindo a cotada, sem preço — spec
  // §4, decisão final do cliente (áudio 16:24): repetir não é problema, pois a lista vem
  // da ficha técnica; o único valor que aparece em qualquer lugar do card é o da cotada,
  // no bloco de Valor da rail. Ordenada por volume crescente (L convertido pra ml
  // equivalente, já que alguns produtos misturam L/ml nas embalagens — ex.: Letah Gel).
  // Ordena por volume equivalente em ml. kg conta como litro (produtos são líquidos/pó
  // com densidade ~1): sem isso "23 kg" (23) vinha antes de "5 L" (5000) e a lista saía
  // fora de ordem — 23 kg · 58 kg · 5 L.
  const volumeOrdenacao = (e: { tamanho: number; unidade: string }) =>
    e.unidade === "L" || e.unidade === "kg" ? e.tamanho * 1000 : e.tamanho;
  // A lista sai de `tamanhosDisponiveis` (os tamanhos que o produto TEM na ficha), não
  // de `embalagens` — desde a spec Item 3 `embalagens` carrega só a COTADA, e ler daqui
  // era o que fazia "escolhi 200 kg" imprimir também o 20 kg com o mesmo preço. Propostas
  // antigas não têm o campo (default []): caem na lista de embalagens, como antes.
  const doProduto = item.tamanhosDisponiveis?.length ? item.tamanhosDisponiveis : item.embalagens;
  // Painel também sai com UM tamanho só (era `> 1`): produto de tamanho único — Primmax
  // Hort FLV (5,3 kg), Pratt Desincrustante (5 L) — ficava sem painel nenhum, e com isso
  // a página inteira não dizia em lugar nenhum que aquela embalagem é a COTADA; o tamanho
  // aparecia só no bloco de Valor da rail (pedido do Matheus, 29/07: "adc em alguns casos
  // a informação de embalagem cotada"). Com um tamanho só o título vira "Embalagem
  // cotada" — "disponíveis" no plural, para uma linha só, lê mal.
  const disponiveis = [...doProduto].sort((a, b) => volumeOrdenacao(a) - volumeOrdenacao(b));
  // A cotada aparece na lista com selo "cotada" — a lista é informação da ficha
  // técnica (todos os tamanhos que o produto tem), e sem o selo o cliente lia os
  // outros tamanhos como se também estivessem sendo ofertados naquele preço
  // (áudio do Matheus 24/07: "marquei o de 5 litros, ele puxou a embalagem de 20").
  const eCotada = (e: { tamanho: number; unidade: string }) =>
    !!cotada && e.tamanho === cotada.tamanho && e.unidade === cotada.unidade;
  const soACotada = disponiveis.length === 1 && eCotada(disponiveis[0]);
  const embalagens = disponiveis.length
    ? `<div class="pp-panel"><h4>${soACotada ? "Embalagem cotada" : "Embalagens disponíveis"}</h4><div class="pp-emb">${disponiveis
        .map((e) =>
          eCotada(e)
            ? `<span class="pp-emb-chip pp-emb-cotada">${esc(tamanhoLegivel(e.tamanho, e.unidade))}<i>cotada</i></span>`
            : `<span class="pp-emb-chip">${esc(tamanhoLegivel(e.tamanho, e.unidade))}</span>`,
        )
        .join("")}</div></div>`
    : "";
  // Aplicação e composição: dois blocos da ficha técnica impressa que o cadastro passou a
  // guardar em 06/08/2026 ("botar exatamente os campos como é a ficha"). Painéis de texto
  // corrido, na ordem em que a ficha os traz — aplicação diz ONDE se usa, composição diz do
  // que é feito, e ambos são pergunta de cliente que o vendedor respondia por telefone.
  const aplicacao = f?.aplicacao
    ? `<div class="pp-panel"><h4>Aplicação</h4><p class="pp-panel-txt">${esc(f.aplicacao)}</p></div>`
    : "";
  const composicao = f?.composicao
    ? `<div class="pp-panel"><h4>Composição</h4><p class="pp-panel-txt">${esc(f.composicao)}</p></div>`
    : "";
  const carac = f?.caracteristicas
    ? `<div class="pp-panel"><h4>Características</h4><div class="pp-rows-cols">${Object.entries(f.caracteristicas)
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="pp-row"><span class="k">${k === "pH" ? "pH" : k === "cloroAtivo" ? "Cloro ativo" : k[0].toUpperCase() + k.slice(1)}</span><span class="v">${esc(String(v))}</span></div>`)
        .join("")}</div></div>`
    : "";

  // Zona de preço: só a embalagem cotada (embalagens[0], resolvida no topo) — nunca
  // lista os demais tamanhos com valor aqui (isso é o bloco "disponíveis" acima, sem preço).
  // Valor por litro DILUÍDO — calculado do preço cotado + a diluição da embalagem
  // cotada (lib/diluicao.ts). Na Proposta Manual essa diluição é a que o consultor
  // digita na montagem (decisão do Gustavo 25/07). É o argumento comercial de verdade
  // ("o principal", áudio 24/07): sem ele o cliente compara R$/embalagem, não R$/litro
  // de uso. Sem diluição informada → não aparece (produto pronto pra uso).
  const diluido = cotada ? custoLitroDiluido(item.embalagens) : null;
  const valores = cotada
    ? `<div class="pp-price"><div class="pp-v-label">Valor</div><div class="pp-v-row"><span class="pp-v-size">${esc(tamanhoLegivel(cotada.tamanho, cotada.unidade))}</span><span class="pp-v-price">${brl(cotada.preco)}</span></div>${
        diluido
          ? `<div class="pp-diluido"><div class="pp-d-label">Valor por litro diluído</div><div class="pp-d-row"><span class="pp-d-price">${esc(diluido.texto)}</span><span class="pp-d-rat">diluição de ${esc(diluido.rotulo)}</span></div></div>`
          : ""
      }<p class="pp-v-note">Consulte condições especiais para compras de maiores volumes.</p></div>`
    : "";

  // Link pra ficha técnica real (PDF em public/fichas-tecnicas/) — só quando o produto
  // tem uma cadastrada E siteUrl foi configurado (nunca gera link relativo/quebrado,
  // já que o PDF final é aberto fora do navegador).
  // Produto sem foto de estúdio cai numa ARTE de recipiente (galão/balde/tonel/frasco,
  // conforme o tamanho — ver imagem-produto.ts). A arte representa a embalagem, não o
  // rótulo do produto, então a página diz isso em letra miúda: desenho nunca passa por
  // foto do que o cliente vai receber (spec Item 1).
  const ilustrativa = imagemEhIlustrativa(item.imagemPath)
    ? `<div class="pp-ilustrativa">Imagem ilustrativa da embalagem</div>`
    : "";

  const linkFicha = item.fichaTecnicaPath && siteUrl
    ? `<a class="pp-ficha-link" href="${esc(siteUrl)}${esc(item.fichaTecnicaPath)}" target="_blank" rel="noopener">Ver ficha técnica completa</a>`
    : "";

  // Rodapé da ficha: slogan fixo + WhatsApp/e-mail do payload (só renderiza contato
  // que existir — nunca número fictício).
  const contatos = [
    contato?.whatsapp ? `<span class="pp-c-item"><span class="ic">${iconeSvg("zap", ORANGE)}</span>WhatsApp ${esc(contato.whatsapp)}</span>` : "",
    contato?.emailConsultor ? `<span class="pp-c-item"><span class="ic">${iconeSvg("email", ORANGE)}</span>${esc(contato.emailConsultor)}</span>` : "",
  ].filter(Boolean).join("");

  // A ordem dos painéis segue a leitura da ficha técnica: onde se aplica → do que é feito →
  // como diluir/usar → quanto rende → em que embalagem → dados físico-químicos.
  const specs =
    aplicacao || composicao || diluicoes || modoUso || rendimento || embalagens || carac
      ? `<div class="pp-specs">${aplicacao}${composicao}${diluicoes}${modoUso}${rendimento}${embalagens}${carac}</div>`
      : "";
  // Página de produto não usa o .pgnum das outras seções: a própria rail já assina o
  // rodapé, e os dois no mesmo canto colidiam. Formato ÚNICO do documento (Fase E):
  // "Página N/T", sem zero à esquerda e sem sufixo — mesma baseline das demais páginas.
  const runmark = numero ? `<div class="pp-runmark">Proposta de Solução <b>${esc(numero)}</b></div>` : "";
  const railFoot = numero
    ? `<div class="pp-railfoot">Página ${Number(numero)}${totalPag ? `/${totalPag}` : ""}</div>`
    : "";

  const wm = logoWhite
    ? `<img class="pp-wm-logo" src="${logoWhite}" alt="Indeba Express"/>`
    : `<div class="pp-wm"><b>indeba</b><span>express</span><i>.</i></div>`;

  // Rodapé padrão (Fase E): o ornamento (mesma arte e MESMO tamanho da capa) entra
  // também na página de produto, ancorado no canto inferior direito da coluna clara —
  // a rail navy tem 79mm, então o ornamento (96mm encostado à direita numa página de
  // 210mm) começa em ~114mm e nunca invade a área escura. Em troca, a assinatura
  // ("Qualidade Profissional" + contatos) sobe para a coluna navy (.pp-railsign),
  // empilhada acima do número de página, com cores invertidas.
  return `<section class="prodpg${simples ? " prodpg-simples" : semVenda ? " prodpg-sem-venda" : ""}${denso ? " prodpg-denso" : ""}">
    ${wave("wave")}
    <aside class="pp-rail">
      ${wm}
      ${eyebrow}
      <div class="pp-figure"><div class="pp-imgcard"><img src="${dataUri}" alt="${titulo}"/></div>${ilustrativa}</div>
      ${valores}
      ${linkFicha}
      <div class="pp-railsign">
        <div class="pp-rs-marca">Qualidade Profissional</div>
        <div class="pp-rs-tag">Resultados que transformam</div>
        ${contatos ? `<div class="pp-rs-contatos">${contatos}</div>` : ""}
      </div>
      ${railFoot}
    </aside>
    <div class="pp-content">
      ${runmark}
      <div class="pp-main">
        <div>
          <h2 class="pp-tit">${titulo}</h2>${categoria}${subtitulo}
          ${descricao ? `<p class="pp-desc">${descricao}</p>` : ""}
        </div>
        ${indicado}
        ${beneficios}
        ${specs}
      </div>
    </div>
  </section>`;
}

// ONDA RICA (Fase E, v3 — "nessa estética mais próxima a nossa logo"): o swoosh do "es"
// reconstruído em vetor, ocupando a faixa inteira do rodapé (viewBox 794,56 × 320 = A4 a
// 96dpi). Composição, na ordem de pintura: barra inferior navy (que "costura" a onda à
// coluna navy da página de produto) → curvas de vento cinza com setas → curva laranja →
// traço navy com seta e dois pontos → onda navy preenchida → eco interno → grade de
// pontos 5×4 + ponto laranja. Geometria da spec VLAEG Fase E v3 §4; validada por
// sobreposição contra o raster da referência do Mateus (proposta-indeba-consolidada__4_).
const wave = (cls: string) => `<svg class="${cls}" viewBox="0 0 794.56 320" fill="none">
  <path d="M0,308 L528,308 L548,320 L0,320 Z" fill="${NAVY}"/>
  <path d="M420,300 C470,278 520,248 558,208" stroke="#D8DDE4" stroke-width="2.2"/>
  <path d="M446,318 C504,296 552,264 596,222" stroke="#D8DDE4" stroke-width="2.2"/>
  <path d="M474,268 C522,244 560,212 590,174" stroke="#D8DDE4" stroke-width="2.2"/>
  <path d="M504,234 C548,212 582,184 608,150" stroke="#D8DDE4" stroke-width="2.2"/>
  <path d="M534,316 C582,298 626,270 662,234" stroke="#D8DDE4" stroke-width="2.2"/>
  <path d="M586,178 l 10,-2 -5,9 Z" fill="#C9D0D9"/>
  <path d="M604,154 l 10,-2 -5,9 Z" fill="#C9D0D9"/>
  <path d="M566,300 C622,294 662,258 692,218 C722,178 742,130 766,102" stroke="${ORANGE}" stroke-width="3"/>
  <path d="M536,310 C602,304 644,266 672,228 C700,190 722,122 779,80" stroke="${NAVY}" stroke-width="3.4"/>
  <path d="M779,80 l -15,1 7,13 Z" fill="${NAVY}"/>
  <circle cx="689" cy="176" r="7" fill="${NAVY}"/>
  <circle cx="656" cy="141" r="4.5" fill="${NAVY}"/>
  <path d="M560,320 C600,318 645,281 679,255.7 C713,230.4 730,138 757,132.3 C771,129.3 782,131.6 794.56,136 L794.56,320 Z" fill="${NAVY}"/>
  <path d="M694,296 C716,268 734,232 750,196" stroke="#1B3A61" stroke-width="2.4"/>
  <path d="M726,306 C748,278 764,242 778,206" stroke="#1B3A61" stroke-width="2.4"/>
  <g fill="#fff" opacity=".9">
    ${Array.from({ length: 20 }, (_, i) => {
      const cx = 716 + (i % 5) * 14.6;
      const cy = 258 + Math.floor(i / 5) * 14.6;
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.5"/>`;
    }).join("")}
  </g>
  <circle cx="694" cy="265" r="3" fill="${ORANGE}"/>
</svg>`;

export function consolidadaHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  assets: { logo: string; logoWhite: string; fontSans: string; fontMono: string; siteUrl?: string; simbolo?: string },
): string {
  const c = scope.consolidada ?? consolidadaDefaults();
  const cli = scope.cliente;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  // Cabeçalho (Fase E): "Proposta de Solução" 10,5px + divisória + número 15px navy —
  // proporção medida na referência (§2: --fs-cab / --fs-cab-num).
  const header = (n: string) => `<div class="pg-head"><img class="hlogo" src="${assets.logo}" alt="IES"/><div class="hpg">Proposta de Solução <b>${n}</b></div></div>`;
  // Fase E: o dash laranja fica sozinho acima do H1 — o H1 já é caixa alta (preset A),
  // repetir o rótulo pequeno em cima duplicava o título (ver referência, pág. 02).
  const secLbl = () => `<div class="lbl"><span></span></div>`;
  // Timbre "es" (Fase E — "essa capa tá bem legal com esse ies de fundo como papel
  // timbrado"): símbolo da logo em opacidade 2,8%, centralizado, na capa e nas seções.
  const timbre = assets.simbolo ? `<img class="timbre" src="${assets.simbolo}" alt=""/>` : "";

  const capaRow = (icone: string, rot: string, val: string) =>
    `<div class="cc-row"><span class="cc-ic">${iconeSvg(icone)}</span><div><div class="cc-r">${esc(rot)}</div><div class="cc-v">${esc(val)}</div></div></div>`;

  const total = totalPaginas(scope.itens.length);

  const capa = `<section class="capa">
    ${pgnum(1, total)}
    ${wave("wave")}
    ${timbre || `<div class="capa-wm">indeba express</div>`}
    <img class="capa-logo" src="${assets.logo}" alt="Indeba Express"/>
    <div class="capa-dash"></div>
    <div class="capa-tit">PROPOSTA DE SOLUÇÃO</div>
    <div class="capa-sub">${esc(c.capa.subtitulo)}</div>
    <div class="capa-card">
      ${capaRow("pessoa", "Cliente", cli.razaoSocial)}
      ${capaRow("pagamento", "CNPJ", cli.cnpj || "—")}
      ${capaRow("prazo", "Segmento", segmentosLegiveis(cli.segmento) || "—")}
      ${capaRow("pessoa", "Responsável", cli.responsavel || "—")}
    </div>
    <div class="capa-cons">
      <div class="capa-cons-row"><span class="capa-fio capa-fio-l"></span><span class="capa-badge">${iconeSvg("pessoa", ORANGE)}</span><span class="capa-fio capa-fio-r"></span></div>
      <div class="cc-lab">Consultor Responsável</div><div class="cc-nome">${esc(c.capa.consultor)}</div>
      <div class="capa-cal">${iconeSvg("prazo")}</div>
      <div class="cc-cidade">${esc(c.capa.cidade)}<br/>${esc(data)}</div>
    </div>
  </section>`;

  const apres = `<section class="pg sec">
    ${pgnum(2, total)}
    ${wave("wave")}
    ${timbre}
    ${header("02")}
    ${secLbl()}
    <h1 class="sec-tit">Apresentação</h1><div class="sec-sub">${esc(c.capa.subtitulo)}</div>
    <p class="sd"><b>${esc(c.apresentacao.saudacao)}</b></p>
    ${c.apresentacao.paragrafos.map((p) => `<p class="pt">${esc(p)}</p>`).join("")}
    <div class="pillars">${c.apresentacao.cards
      .map((cd) => `<div class="pill"><span class="pi">${iconeSvg(cd.icone, "#fff")}</span><div><h3>${esc(cd.titulo)}</h3><p>${esc(cd.texto)}</p></div></div>`)
      .join("")}</div>
    <div class="sign">
      <div><div class="n">${esc(c.condicoes.consultor)}</div><div class="r">${esc(c.condicoes.cargo)}</div></div>
      <div><div class="n">Indeba Express</div><div class="r">${esc(c.capa.subtitulo)}</div></div>
    </div>
  </section>`;

  const comod = `<section class="pg sec">
    ${pgnum(3, total)}
    ${wave("wave")}
    ${timbre}
    ${header("03")}
    ${secLbl()}
    <h1 class="sec-tit">Comodatos Oferecidos</h1><div class="sec-sub">Equipamentos em Comodato</div>
    <p class="pt">${esc(c.comodatos.intro)}</p>
    <div class="equip">${c.comodatos.equipamentos
      .map((e) => `<div class="eq"><span class="ei">${iconeSvg(e.icone, "#fff")}</span><h3>${esc(e.titulo)}</h3>${e.descricao ? `<p>${esc(e.descricao)}</p>` : ""}</div>`)
      .join("")}</div>
    <div class="adv">
      <h4>Vantagens do Comodato</h4>
      <div class="adv-grid">${c.comodatos.vantagens
        .map((v) => `<div class="av"><span class="chk">${iconeSvg("check-simples", "#fff")}</span><span>${esc(v)}</span></div>`)
        .join("")}</div>
    </div>
  </section>`;

  const contato = c.contato ?? { whatsapp: null, emailConsultor: null };
  // Numeração do header deriva do índice real (capa=01 sem header, apresentação=02,
  // comodatos=03, 1 página por produto a partir de 04) — bate com "Página X/Y" do
  // rodapé (.pgnum), já que cada seção é garantidamente 1 página.
  const PRIMEIRO_PRODUTO = 4;
  const produtos = scope.itens
    .map((it, idx) =>
      // `cli.segmento` alimenta o rótulo "LINHA {SEGMENTO}" da ficha (spec Item 2) —
      // é o segmento que o consultor informou na montagem, não um rótulo do produto.
      paginaProduto(it, imagens[chaveImagem(it)] ?? "", contato, String(PRIMEIRO_PRODUTO + idx).padStart(2, "0"), assets.logoWhite, assets.siteUrl, total, cli.segmento),
    )
    .join("");

  const cond = `<section class="pg sec">
    ${pgnum(total, total)}
    ${wave("wave")}
    ${timbre}
    ${header(String(PRIMEIRO_PRODUTO + scope.itens.length).padStart(2, "0"))}
    ${secLbl()}
    <h1 class="sec-tit">Condições Comerciais</h1><div class="sec-sub">Informações Gerais da Proposta</div>
    <div class="conds">${c.condicoes.itens
      .map((i) => `<div class="condi"><span class="ci">${iconeSvg(i.icone)}</span><div><h3>${esc(i.titulo)}</h3><p>${esc(i.texto)}</p></div></div>`)
      .join("")}</div>
    <div class="closing">
      <div class="msg">${esc(c.condicoes.mensagemFechamento)}<em>Atenciosamente,</em></div>
      <div class="cl-sign">
        <div class="n">${esc(c.condicoes.consultor)}</div>
        <div class="r">${esc(c.condicoes.cargo)}</div>
        ${contato.emailConsultor ? `<div class="cl-contato"><span class="ic">${iconeSvg("email", "#fff")}</span>${esc(contato.emailConsultor)}</div>` : ""}
        ${contato.whatsapp ? `<div class="cl-contato"><span class="ic">${iconeSvg("zap", "#fff")}</span>${esc(contato.whatsapp)}</div>` : ""}
        <div class="b">Indeba Express</div>
      </div>
    </div>
  </section>`;

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>
/* Tipografia da marca (Geist/Geist Mono — mesma da plataforma, tokens/typography.css
   do skill indeba-design). Fonte de arquivo (variável), embutida como data-URI: o
   render bloqueia requisição externa, então CDN não funciona aqui. */
/* font-display: block (não swap) — com swap o Chromium pintava o texto na fonte
   reserva e o PDF podia ser tirado ANTES da troca: a "letra grosseira/serrilhada"
   era a fonte substituta do Chromium serverless, não a Geist. O render também
   espera document.fonts.ready antes do page.pdf (render.ts). */
@font-face { font-family: "Geist"; src: url("${assets.fontSans}") format("woff2"); font-weight: 100 900; font-display: block; }
@font-face { font-family: "Geist Mono"; src: url("${assets.fontMono}") format("woff2"); font-weight: 100 900; font-display: block; }
* { box-sizing: border-box; margin: 0; padding: 0; }
/* Escala Fase E v3 — medida na referência do Mateus (§2 da spec: unidade u × 0,7846),
   não estimada: H1 28px · sub 13px · corpo 11px/1,6 · card 11/9px · cabeçalho 10,5px ·
   nº de página 15px · nome em destaque 11,5px/700. Margem lateral 62px (--sp-margem). */
body { font-family: "Geist", "Segoe UI", Arial, sans-serif; color: #2a3746; font-size: 11px; }
.pg { padding: 14px 62px 0; position: relative; }
/* Timbre "es" — papel timbrado a 2,8% de opacidade (feedback do Mateus, 10/08),
   sempre atrás de todo o conteúdo. */
.timbre { position: absolute; z-index: 0; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 150mm; height: auto; opacity: .028; }
/* Cada seção é UMA página — altura FIXA (não auto): sem isso, se o conteúdo de uma seção
   passar de 1 página impressa (ex.: comodatos com mais itens), o box CSS cresce além da
   página física e a onda (position:absolute;bottom:0, ancorada nesse box) passa a flutuar
   no meio/cortar — porque "bottom" nesse caso não é mais o rodapé da página real, é o fim
   de um box que já vazou pra página seguinte. ALTURA_PAGINA = A4 (297mm) menos a margem
   inferior do PDF (MARGEM_INFERIOR_CONSOLIDADA, render.ts) — EXATAMENTE a área imprimível,
   sem folga: a folga de 4-7mm que existia aqui era a faixa branca no pé de toda página
   ("todas as páginas estão com esse recorte", áudio do Matheus 24/07), porque o fundo
   colorido (capa cinza, rail navy) parava antes da borda. overflow:hidden é o
   cinto-e-suspensório se algum conteúdo ainda assim passar do previsto (fica invisível,
   não mancha a página seguinte). */
.sec { page-break-after: always; overflow: hidden; padding-bottom: 28mm; height: ${ALTURA_PAGINA}; }
.sec:last-of-type { page-break-after: auto; }
/* Onda decorativa das páginas internas: SEMPRE atrás do conteúdo (mesma regra da capa) —
   28mm de faixa de segurança acima (padding-bottom do .sec) garante que texto nunca encoste. */
.sec > *:not(.wave):not(.pgnum):not(.timbre) { position: relative; z-index: 1; }
/* Paginação impressa DENTRO da página (substitui o rodapé nativo do Chromium, que exigia
   margem inferior — a faixa branca que cortava o fundo). Ancorada no canto inferior
   ESQUERDO da seção (que tem position:relative e altura de página cheia): a arte
   (onda/quarto de círculo navy) mora no canto inferior direito de toda página, e ali
   o número cairia em cima dela. */
/* Fase E — baseline única: nº de página a 30px do pé, alinhado à margem de conteúdo
   (16mm), Geist 8px/400, formato "Página N/T" em todas as páginas. */
.pgnum { position: absolute; left: 62px; bottom: 30px; z-index: 3;
  font-size: 8px; font-weight: 400; letter-spacing: .06em; color: #8a94a6; }
/* Onda rica: FAIXA de largura total no pé da página (viewBox 794,56×320 = A4 a 96dpi),
   idêntica em todas as páginas. Trava anti-escala: o corte das internas veio de escala
   herdada — tamanho fixo, sem transform. */
.wave { transform: none !important; max-width: none; max-height: none; }
.pg-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5ebf2; padding-bottom: 8px; margin-bottom: 46px; }
.hlogo { height: 46px; }
.hpg { color: #7a8696; font-size: 10.5px; display: flex; align-items: center; }
.hpg b { color: ${NAVY}; font-size: 15px; font-weight: 600; margin-left: 10px; padding-left: 12px; border-left: 1px solid #d8dde4; }
/* H1 de seção (Fase E v3, preset A da validação): caixa alta, 800, 28px — medido na
   referência (36u × 0,7846). "Não tão grandes" resolvido por medida, não estimativa. */
.sec-tit { color: ${NAVY}; font-size: 28px; font-weight: 800; letter-spacing: -.01em; text-transform: uppercase; }
.sec-sub { color: ${ORANGE}; font-weight: 500; font-size: 13px; margin: 6px 0 30px; }
b, strong { font-weight: 700; }
.sd { margin: 6px 0 10px; } .pt { color: #46505f; line-height: 1.6; margin-bottom: 10px; }
.ic { display: inline-flex; vertical-align: middle; }
/* Dash laranja sozinho acima do H1 (o H1 já é caixa alta — sem rótulo duplicado). */
.lbl { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
.lbl span { width: 24px; height: 3px; background: ${ORANGE}; border-radius: 2px; }
/* Apresentação — cards VERTICAIS brancos (referência pág. 02): ícone em círculo navy,
   divisória laranja 34×2 sob o título (novidade do print das págs. 03/04 — mais recente
   que o PDF, então manda), título navy caixa alta, texto cinza. */
.pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 30px; }
.pill { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 20px 12px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  box-shadow: 0 6px 18px rgba(11,42,74,.06); }
.pill .pi { width: 52px; height: 52px; flex: none; border-radius: 50%; background: ${NAVY}; display: flex; align-items: center; justify-content: center; }
.pill .pi svg { width: 24px; height: 24px; }
.pill h3 { color: ${NAVY}; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .02em; line-height: 1.3; margin-top: 12px; }
.pill h3::after { content: ""; display: block; width: 34px; height: 2px; background: ${ORANGE}; margin: 8px auto 0; border-radius: 1px; }
.pill p { color: #6b7787; font-size: 9px; line-height: 1.5; margin-top: 8px; }
/* Assinatura da Apresentação — nome em destaque: 700/11,5px SEMPRE; cargo 10px #8A94A6
   (feedback do Mateus: destaque por peso, nunca por corpo). */
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px solid #e5ebf2; padding-top: 16px; margin-top: 30px; }
.sign .n { color: ${NAVY}; font-weight: 700; font-size: 11.5px; }
.sign .r { color: #8a94a6; font-size: 10px; margin-top: 2px; }
/* Comodatos — equipamentos em tile maior + painel navy de vantagens */
.equip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
.eq { background: #eef2f7; border-radius: 14px; padding: 20px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.eq .ei { width: 46px; height: 46px; border-radius: 12px; background: ${NAVY}; display: flex; align-items: center; justify-content: center; }
.eq .ei svg { width: 22px; height: 22px; }
.eq h3 { color: ${NAVY}; font-weight: 700; font-size: 11px; line-height: 1.3; text-transform: uppercase; }
/* Divisória laranja sob o título — mesma dos cards da Apresentação (print págs. 03/04). */
.eq h3::after { content: ""; display: block; width: 34px; height: 2px; background: ${ORANGE}; margin: 8px auto 0; border-radius: 1px; }
.eq p { color: #6b7787; font-size: 9px; line-height: 1.5; }
/* Vantagens do Comodato: texto ERA 9.5px e ficava ilegível no impresso (áudio do
   Matheus 24/07 — "aumentar a letra, está muito pequenininho"). Escala toda a
   caixa junto (título, check e espaçamento) pra continuar equilibrada. */
.adv { background: ${NAVY}; border-radius: 16px; padding: 26px 28px; color: #fff; margin-top: 20px; }
.adv h4 { text-align: center; font-weight: 500; font-size: 13px; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(255,255,255,.9); margin-bottom: 18px; }
.adv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.av { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.av .chk { width: 30px; height: 30px; border-radius: 50%; background: ${ORANGE}; display: flex; align-items: center; justify-content: center; flex: none; }
.av .chk svg { width: 16px; height: 16px; }
.av span { font-size: 12px; line-height: 1.45; color: #fff; }
/* Capa — fundo claro (padrão validado), decorativos SEMPRE atrás do conteúdo */
.capa { height: ${ALTURA_PAGINA}; position: relative; display: flex; flex-direction: column; align-items: center;
  padding-top: 60px; padding-bottom: 110px; page-break-after: always; overflow: hidden; background: #f6f7f9; }
.capa > *:not(.wave):not(.capa-wm):not(.pgnum):not(.timbre) { position: relative; z-index: 1; }
/* Onda rica em FAIXA (Fase E): largura total da página, 320px de altura no pé. */
.wave { position: absolute; z-index: 0; left: 0; right: 0; bottom: 0; width: 100%; height: auto; }
/* Marca-d'água gigante atrás do card — decorativa, nunca disputa leitura com o conteúdo */
.capa-wm { position: absolute; z-index: 0; top: 46%; left: 50%; transform: translate(-50%, -50%);
  font-size: 68px; font-weight: 800; color: ${NAVY}; opacity: .045; white-space: nowrap; letter-spacing: -1px; }
.capa-logo { width: 190px; margin-bottom: 22px; }
.capa-dash { width: 46px; height: 2px; background: ${ORANGE}; position: relative; margin-bottom: 14px; }
.capa-dash::before, .capa-dash::after { content: ""; position: absolute; top: -5px; width: 2px; height: 12px; background: ${ORANGE}; }
.capa-dash::before { left: -2px; } .capa-dash::after { right: -2px; }
.capa-tit { color: ${NAVY}; font-size: 24px; font-weight: 600; letter-spacing: .22em; }
.capa-sub { color: #6b7787; font-size: 13px; margin-top: 6px; }
.capa-card { background: #fff; border: 1px solid #eef2f7; border-radius: 16px; box-shadow: 0 8px 30px rgba(11,42,74,.08); padding: 18px 26px; margin-top: 40px; width: 340px; }
.cc-row { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f3f7; }
.cc-row:last-child { border-bottom: none; } .cc-ic { width: 38px; height: 38px; border-radius: 50%; background: ${NAVY}; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.cc-ic svg { width: 18px; height: 18px; stroke: #fff; } .cc-r { color: #8a94a6; font-size: 9.5px; } .cc-v { color: ${NAVY}; font-weight: 700; font-size: 11.5px; }
.capa-cons { text-align: center; margin-top: 40px; }
.capa-cons-row { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
.capa-fio { width: 70px; height: 1px; } .capa-fio-l { background: linear-gradient(90deg, transparent, ${ORANGE}); }
.capa-fio-r { background: linear-gradient(90deg, ${ORANGE}, transparent); }
.capa-badge { width: 36px; height: 36px; border: 1.5px solid ${ORANGE}; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.capa-badge svg { width: 17px; height: 17px; }
.cc-lab { color: #8a95a3; font-size: 11px; margin-top: 10px; }
.cc-nome { color: ${NAVY}; font-weight: 700; font-size: 11.5px; margin-top: 2px; }
.capa-cal { margin-top: 22px; } .capa-cal svg { width: 20px; height: 20px; }
.cc-cidade { color: #6b7787; font-size: 11px; margin-top: 13px; }
/* Condições — grid 2 colunas de itens + fechamento navy (mensagem + assinatura) */
.conds { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-top: 16px; }
.condi { display: flex; gap: 11px; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #e5ebf2; }
.condi .ci { width: 34px; height: 34px; flex: none; border-radius: 10px; background: #eef2f7; display: flex; align-items: center; justify-content: center; }
.condi .ci svg { width: 17px; height: 17px; }
.condi h3 { color: ${NAVY}; font-weight: 500; font-size: 13.5px; }
.condi p { color: #6b7787; font-size: 11.5px; line-height: 1.4; margin-top: 3px; }
.closing { background: ${NAVY}; border-radius: 16px; padding: 22px 26px; color: #fff; display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-top: 22px; }
.closing .msg { font-size: 11px; line-height: 1.6; color: rgba(255,255,255,.8); max-width: 290px; }
.closing .msg em { color: #fff; font-style: normal; display: block; margin-top: 8px; font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; opacity: .7; }
.cl-sign { text-align: right; }
.cl-sign .n { font-weight: 800; font-size: 15px; }
.cl-sign .r { font-size: 9.5px; color: rgba(255,255,255,.6); margin-top: 2px; }
.cl-sign .b { margin-top: 8px; font-weight: 700; font-size: 10.5px; }
.cl-contato { display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 8px; font-size: 9.5px; color: rgba(255,255,255,.85); }
.cl-contato .ic svg { width: 12px; height: 12px; }
/* Página de produto — layout "rail": faixa navy à esquerda (marca/foto/preço) +
   coluna de conteúdo à direita (texto/specs). Altura fixa (mesmo raciocínio do
   .sec acima — impede que a página estoure e vaze layout pra página seguinte). */
.prodpg { height: ${ALTURA_PAGINA}; overflow: hidden; page-break-after: always; display: flex; position: relative; }
/* Ornamento do rodapé também na página de produto (Fase E) — mesma âncora e tamanho da
   capa, sempre ATRÁS do conteúdo; a rail navy (79mm) nunca é invadida (o ornamento
   começa em ~114mm da esquerda). */
.prodpg > *:not(.wave) { position: relative; z-index: 1; }
.pp-rail { width: 79mm; flex: none; color: #fff; background: linear-gradient(165deg, ${NAVY} 0%, #06203f 100%);
  display: flex; flex-direction: column; padding: 32px 26px 30px; }
/* Assinatura na coluna navy (subiu da coluna clara, que agora é do ornamento):
   hairline + cores invertidas, empilhada acima do número de página. */
.pp-railsign { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.14); }
.pp-rs-marca { font-size: 9.5px; font-weight: 500; letter-spacing: 1px; color: #fff; text-transform: uppercase; }
.pp-rs-tag { font-size: 8.5px; letter-spacing: .5px; color: #7e8da3; text-transform: uppercase; margin-top: 2px; }
.pp-rs-contatos { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.pp-rs-contatos .pp-c-item { color: #c3cedc; }
.pp-wm { font-size: 17px; letter-spacing: .2px; }
.pp-wm b { font-weight: 800; } .pp-wm span { font-weight: 400; opacity: .8; margin-left: 3px; }
.pp-wm i { color: ${ORANGE}; font-style: normal; }
.pp-wm-logo { height: 32px; width: auto; align-self: flex-start; display: block; }
.pp-eyebrow { margin-top: 12px; font-size: 10px; letter-spacing: 2.4px; color: rgba(255,255,255,.55); text-transform: uppercase; }
.pp-eyebrow b { color: ${ORANGE}; font-weight: 700; margin-left: 6px; }
.pp-figure { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px 0; }
/* Legenda de imagem ILUSTRATIVA (arte de recipiente, produto sem foto de estúdio).
   Discreta de propósito: informa sem competir com a ficha. */
.pp-ilustrativa { margin-top: 8px; font-size: 8.5px; letter-spacing: .6px; color: rgba(255,255,255,.5); text-transform: uppercase; }
/* Card da foto: fundo BRANCO (não mais cinza) — a foto de produto (recorte com fundo
   removido) fica sobre branco, sem a "caixa cinza" que o Matheus apontou ("o meio ficou
   branco com cinza", áudio 24/07). A borda fina segura o card contra a rail navy. */
/* Altura do card ERA 460px com a foto limitada a 208px de largura: como o recipiente é
   sempre mais alto que largo (proporção ~0,75), a foto travava na LARGURA e desenhava
   208x250 — 47% do card, com ~200px de branco morto embaixo e em cima. Somando a
   moldura transparente que a foto de estúdio traz (o produto ocupa ~1/3 da tela do
   arquivo), o produto saía com ~110x150px numa rail de 79mm: o "ajustar as imagens aos
   tamanhos" do Matheus (29/07). Agora a margem transparente é recortada no render
   (recortarMargem em pdf/render.ts) e o card acompanha a foto — mesma largura, altura
   colada no que a imagem realmente usa. Card FIXO (não auto): mantém as fichas do
   documento inteiro com a mesma caixa, independentemente da proporção de cada foto. */
.pp-imgcard { width: 240px; height: 330px; background: #fff; border: 1px solid #e6ebf2; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 14px 30px -14px rgba(0,0,0,.35); }
.pp-imgcard img { max-width: 216px; max-height: 300px; object-fit: contain; }
/* Zona de Valor da rail (do rótulo VALOR ao rodapé de página): tipografia +25% em toda
   a caixa — print do Matheus, 29/07. É o bloco que o cliente lê primeiro e vinha em
   corpo de nota de rodapé (8,5-9,5px). Escala aplicada linha a linha, para o valor
   grande e a letra miúda crescerem juntos e a hierarquia continuar a mesma:
   9,5→11,9 · 12→15 · 27→33,8 · 9→11,3 · 8,5→10,6. A nota de "maiores volumes" ganha
   largura na mesma proporção (200→250px), senão a fonte maior só a faz quebrar mais. */
.pp-price { border-top: 1px solid rgba(255,255,255,.16); padding-top: 16px; }
.pp-v-label { font-size: 11.9px; letter-spacing: 2.4px; color: rgba(255,255,255,.55); text-transform: uppercase; }
.pp-v-row { display: flex; align-items: baseline; gap: 10px; margin-top: 7px; }
.pp-v-size { font-size: 15px; font-weight: 700; color: ${ORANGE}; letter-spacing: .5px; }
.pp-v-price { font-family: "Geist Mono", monospace; font-size: 33.8px; font-weight: 700; letter-spacing: .3px; }
.pp-v-note { font-size: 11.3px; line-height: 1.4; color: rgba(255,255,255,.5); margin-top: 8px; max-width: 250px; }
/* Valor por litro diluído — segundo destaque da rail (o preço da embalagem manda
   no tamanho; este manda na cor). Fio superior separa do preço sem virar outro card. */
.pp-diluido { margin-top: 12px; padding-top: 11px; border-top: 1px dashed rgba(255,255,255,.22); }
.pp-d-label { font-size: 11.3px; letter-spacing: 1.6px; color: rgba(255,255,255,.55); text-transform: uppercase; }
.pp-d-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-top: 5px; }
.pp-d-price { font-family: "Geist Mono", monospace; font-size: 21.3px; font-weight: 700; color: ${ORANGE}; }
.pp-d-rat { font-size: 10.6px; color: rgba(255,255,255,.6); }
.pp-ficha-link { display: inline-block; margin-top: 12px; font-size: 11.3px; font-weight: 700; color: ${ORANGE}; text-decoration: underline; }
/* Mesma baseline (30px do pé) e mesmo corpo do .pgnum das outras páginas; a cor
   #7E8DA3 é a variante legível sobre a rail navy. Alinhado à margem interna da rail. */
.pp-railfoot { margin-top: 12px; font-size: 8px; font-weight: 400; letter-spacing: .06em; color: #7e8da3; }
/* Coluna de conteúdo: o bloco principal começa do TOPO (flex-start) — a centralização
   vertical fazia o título de produto com ficha curta "começar no meio da folha"
   (correção pedida pelo CEO, ago/2026). Ficha curta deixa respiro embaixo, que é o
   comportamento esperado de uma ficha; contato segue ancorado no fim da página. */
.pp-content { flex: 1; padding: 30px 34px 24px; display: flex; flex-direction: column; }
.pp-runmark { align-self: flex-end; font-size: 9.5px; letter-spacing: 1px; color: #9aa3ae; text-transform: uppercase; }
.pp-runmark b { color: ${NAVY}; }
.pp-main { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; gap: 18px; }
.pp-tit { color: ${NAVY}; font-size: 25px; font-weight: 400; line-height: 1.08; letter-spacing: -.02em; }
.pp-sub { color: ${ORANGE}; font-weight: 500; font-size: 13px; margin-top: 4px; text-transform: uppercase; }
.pp-eyebrow-cat { color: #8a95a3; font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; margin-top: 4px; }
.pp-desc { color: #5a6878; font-size: 11.5px; line-height: 1.55; max-width: 400px; }
.pp-label { display: inline-block; background: ${NAVY}; color: #fff; font-size: 10px; font-weight: 500;
  letter-spacing: 1.3px; text-transform: uppercase; padding: 6px 13px; border-radius: 7px; margin-bottom: 12px; }
.pp-icons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.pp-ic { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.pp-ic .ic { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
.pp-ic .ic svg { width: 20px; height: 20px; } .pp-ic span { font-size: 8.5px; line-height: 1.2; color: #6b7787; }
.pp-benes { display: flex; flex-direction: column; gap: 7px; }
.pp-be { display: flex; gap: 8px; align-items: flex-start; }
.pp-chk { width: 18px; height: 18px; border-radius: 50%; background: ${ORANGE}; display: flex; align-items: center; justify-content: center; flex: none; margin-top: 1px; }
.pp-chk svg { width: 10px; height: 10px; }
.pp-be p { font-size: 11px; line-height: 1.4; color: #2a3746; }
/* Specs: painéis empilhados em largura total — 1-4 conforme o que a ficha tiver
   (diluição, rendimento, embalagens, características); nenhum é inventado. */
.pp-specs { display: flex; flex-direction: column; gap: 10px; }
.pp-panel { background: #eef2f7; border-radius: 12px; padding: 13px 14px; }
.pp-panel h4 { color: ${NAVY}; font-size: 9px; font-weight: 500; letter-spacing: 1.3px; text-transform: uppercase;
  text-align: center; padding-bottom: 8px; margin-bottom: 9px; border-bottom: 1px solid #e0e6ee; }
.pp-emb { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.pp-emb-chip { display: inline-block; font-family: "Geist Mono", monospace; font-weight: 700; font-size: 12px; color: ${NAVY};
  background: #fff; border: 1px solid #d6dee8; border-radius: 8px; padding: 7px 16px; }
/* Chip da embalagem COTADA: os demais tamanhos são só informação da ficha técnica —
   o selo evita que o cliente leia a lista como oferta de todos os tamanhos. */
.pp-emb-cotada { border-color: ${ORANGE}; box-shadow: inset 0 0 0 1px ${ORANGE}; }
.pp-emb-cotada i { display: inline-block; font-family: "Geist", sans-serif; font-style: normal; font-size: 8px;
  font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: ${ORANGE}; margin-left: 7px; }
/* Diluição: finalidade (curta, cinza) à esquerda e a instrução à direita. Antes as duas
   iam nas pontas com space-between e a instrução em bandeira à direita — numa frase
   longa ("2 partes de Primmax DGClor para até 100 partes de solução; pré-lavar…") isso
   virava um bloco de 4 linhas com a margem esquerda serrilhada, difícil de ler. Agora é
   grid de colunas fixas (a instrução alinhada à esquerda, alinhando entre as linhas) e
   um fio separando cada finalidade.
   Características (valores curtos: "Líquido", "Amarelo") continua num grid 2 colunas
   à parte (.pp-rows-cols), com k/v coladinhos — space-between ali jogaria o
   valor pra ponta da célula, longe da chave. */
.pp-rows { display: flex; flex-direction: column; }
/* Aplicação e composição são parágrafo, não k/v: texto corrido dentro do painel,
   com o mesmo tamanho das linhas de spec para não competir com os benefícios. */
.pp-panel-txt { font-size: 10px; line-height: 1.5; color: #46586c; margin: 0; text-align: justify; }
.prodpg-denso .pp-panel-txt { font-size: 9.2px; line-height: 1.4; }
.pp-rows-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
.pp-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; }
.pp-row .k { color: #6b7787; } .pp-row .v { font-weight: 700; color: ${NAVY}; text-align: right; }
.pp-rows .pp-row { display: grid; grid-template-columns: 31% 1fr; gap: 14px; align-items: baseline;
  padding: 7px 0; border-top: 1px solid #dfe6ee; }
.pp-rows .pp-row:first-child { border-top: none; padding-top: 1px; }
.pp-rows .pp-row .k { display: block; font-size: 9.5px; line-height: 1.35; }
.pp-rows .pp-row .k::first-letter { text-transform: uppercase; } /* fichas trazem tudo em caixa baixa */
.pp-rows .pp-row .v { font-weight: 600; text-align: left; line-height: 1.5; }
.pp-rows-cols .pp-row { justify-content: flex-start; }
.pp-rows-cols .pp-row .k { flex: none; } .pp-rows-cols .pp-row .v { text-align: left; }
/* Modo de uso (3 colunas: finalidade/diluição/como aplicar) — só quando a ficha
   técnica real traz o texto de aplicação; tabela de verdade (não k/v), já que aqui
   são 3 valores por linha, não um par. */
.pp-panel-modo { background: transparent; border: 1px solid #e0e6ee; padding: 0; overflow: hidden; }
.pp-panel-modo h4 { background: #eef2f7; padding: 10px 14px; margin-bottom: 0; border-bottom: 1px solid #e0e6ee; }
.pp-modo-tb { width: 100%; border-collapse: collapse; }
.pp-modo-tb th { background: ${NAVY}; color: #fff; font-size: 8.5px; text-transform: uppercase; letter-spacing: .5px; text-align: left; padding: 7px 10px; }
.pp-modo-tb td { font-size: 9.5px; color: #4a5768; padding: 7px 10px; border-bottom: 1px solid #f0f3f7; vertical-align: top; }
.pp-modo-tb tr:last-child td { border-bottom: none; }
.pp-big { text-align: center; color: ${ORANGE}; font-weight: 800; font-size: 12px; }
/* Rendimento multi-dosagem (Sanquat, Sanclor, Sanap…): lista legível em vez de paredão
   laranja centralizado. Dose em destaque, contexto (entre parênteses) em cinza abaixo. */
.pp-rlist { list-style: none; }
.pp-rlist li { padding: 3px 0; border-top: 1px solid #e0e6ee; }
.pp-rlist li:first-child { border-top: none; padding-top: 0; }
.pp-rlist li b { display: block; color: ${ORANGE}; font-weight: 800; font-size: 9.5px; }
.pp-rlist li span { display: block; color: #6b7787; font-size: 8.5px; line-height: 1.3; margin-top: 1px; }
/* Modo denso — fichas muito longas (ver "denso" em paginaProduto). Mesma página, mesmo
   conteúdo: só tipografia e respiros mais justos, pra nada ser cortado pelo overflow. */
.prodpg-denso .pp-tit { font-size: 22px; }
.prodpg-denso .pp-desc { font-size: 10.5px; line-height: 1.45; }
.prodpg-denso .pp-main { gap: 12px; }
.prodpg-denso .pp-label { margin-bottom: 9px; padding: 5px 11px; }
.prodpg-denso .pp-benes { gap: 5px; }
.prodpg-denso .pp-be p { font-size: 9.8px; line-height: 1.35; }
.prodpg-denso .pp-specs { gap: 7px; }
.prodpg-denso .pp-panel { padding: 9px 12px; }
.prodpg-denso .pp-panel h4 { padding-bottom: 6px; margin-bottom: 6px; }
.prodpg-denso .pp-rows .pp-row { padding: 4.5px 0; font-size: 9.2px; }
.prodpg-denso .pp-rows .pp-row .k { font-size: 8.8px; }
.prodpg-denso .pp-rows .pp-row .v { line-height: 1.4; }
.prodpg-denso .pp-rows-cols .pp-row { font-size: 9.2px; }
.pp-c-item { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; color: #2a3746; }
.pp-c-item .ic svg { width: 13px; height: 13px; }
</style></head><body>
${capa}
${apres}
${comod}
${produtos}
${cond}
</body></html>`;
}
