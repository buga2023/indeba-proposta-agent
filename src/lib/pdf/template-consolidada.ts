import type { PropostaItem, PropostaScope } from "../contracts";
import { consolidadaDefaults } from "../consolidada-defaults";

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
  if (partes.length === 1 && r.length <= 46) return `<div class="p-big">${esc(r)}</div>`;
  return `<ul class="p-rlist">${partes
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

// Uma página A4 rica por produto. Cada bloco só aparece se o dado existir.
// `headerHtml` (a mesma `.pg-head` das outras seções) e `simples` (produto sem
// indicado/benefícios/diluição/características/rendimento → layout compacto,
// centralizado verticalmente, em vez do rígido de sempre deixando meia página vazia).
export function paginaProduto(item: PropostaItem, dataUri: string, contato?: ContatoConsolidada, headerHtml = ""): string {
  const f = item.ficha ?? null;
  const titulo = f?.titulo ? esc(f.titulo) : esc(item.nome);
  const subtitulo = f?.subtitulo ? `<div class="p-sub">${esc(f.subtitulo)}</div>` : "";
  const badge = f?.linhaLabel ? `<span class="p-badge">LINHA <b>${esc(f.linhaLabel)}</b></span>` : "";
  const headBar = badge ? `<div class="p-head">${badge}</div>` : ""; // sem linha → sem barra vazia
  const descricao = esc(f?.descricao || item.descricaoUso || "");
  // Diluição: a ficha rica (indicadoPara/benefícios/características/rendimento) é dado de
  // catálogo que só existe pra alguns produtos (Primmax Plus/DGClor) — não inventamos pros
  // outros. Mas a EMBALAGEM já carrega diluicaoMax/custoDiluido pra vários produtos "simples"
  // (ex.: Primmax LDF, Primmax Hort) e o template não lia isso — dado real, só não estava sendo
  // usado aqui (é lido em template.ts pro modelo Express).
  const diluicaoEmbalagem = item.embalagens.find((e) => e.diluicaoMax);
  const simples = !f?.indicadoPara?.length && !f?.beneficios?.length && !f?.diluicoes?.length && !diluicaoEmbalagem && !f?.caracteristicas && !f?.rendimento;
  // Meio-termo: tem dado técnico (características/rendimento/diluição) mas falta a parte
  // "de venda" (indicado para/benefícios) — maioria do catálogo hoje (só 2 produtos têm
  // ficha de marketing completa). Sem isso, o bloco ao lado da foto sobra vazio; aqui a
  // foto cresce um pouco para preencher melhor, sem virar o layout ultra-compacto (`simples`).
  const semVenda = !simples && !f?.indicadoPara?.length && !f?.beneficios?.length;

  const indicado = f?.indicadoPara?.length
    ? `<div class="p-block"><div class="p-bt">Indicado para</div><div class="p-ind">${f.indicadoPara
        .map((i) => `<div class="p-ic"><span class="ic">${iconeSvg(i.icone)}</span><span>${esc(i.label)}</span></div>`)
        .join("")}</div></div>`
    : "";

  const beneficios = f?.beneficios?.length
    ? `<div class="p-block"><div class="p-bt">Principais benefícios</div><ul class="p-ben">${f.beneficios
        .map((b) => `<li><span class="ic ic-ok">${iconeSvg("check", ORANGE)}</span>${esc(b)}</li>`)
        .join("")}</ul></div>`
    : "";

  const diluicoes = f?.diluicoes?.length
    ? `<div class="p-mini"><div class="p-mt">Modo de diluição</div>${f.diluicoes
        .map((d) => `<div class="p-row"><span>${esc(d.uso)}</span><b>${esc(d.razao)}</b></div>`)
        .join("")}</div>`
    : diluicaoEmbalagem
      ? `<div class="p-mini"><div class="p-mt">Modo de diluição</div>
          <div class="p-row"><span>Diluição máxima</span><b>${esc(diluicaoEmbalagem.diluicaoMax!)}</b></div>
          ${diluicaoEmbalagem.custoDiluido ? `<div class="p-row"><span>Custo/litro diluído</span><b>${brl(diluicaoEmbalagem.custoDiluido)}</b></div>` : ""}
        </div>`
      : "";
  const rendimento = f?.rendimento
    ? `<div class="p-mini"><div class="p-mt">Rendimento aproximado</div>${fmtRendimento(f.rendimento)}</div>`
    : "";
  // Embalagem cotada = SEMPRE embalagens[0] (mesma convenção do resto do app —
  // preço/subtotal na revisão/dashboard também usam a primeira). "Disponíveis" lista
  // TODOS os tamanhos do produto (ficha técnica), incluindo a cotada, sem preço — spec
  // §8, decisão final do cliente (áudio 16:24): repetir não é problema, pois a lista vem
  // da ficha técnica; o único valor que aparece em qualquer lugar do card é o da cotada,
  // na barra de Valor abaixo. Ordenada por volume crescente (L convertido pra ml
  // equivalente, já que alguns produtos misturam L/ml nas embalagens — ex.: Letah Gel).
  const volumeOrdenacao = (e: (typeof item.embalagens)[number]) => (e.unidade === "L" ? e.tamanho * 1000 : e.tamanho);
  const disponiveis = item.embalagens.length > 1 ? [...item.embalagens].sort((a, b) => volumeOrdenacao(a) - volumeOrdenacao(b)) : [];
  const embalagens = disponiveis.length
    ? `<div class="p-mini"><div class="p-mt">Embalagens disponíveis</div>${disponiveis
        .map((e) => `<div class="p-row"><span>${e.tamanho} ${esc(e.unidade)}</span></div>`)
        .join("")}</div>`
    : "";
  const carac = f?.caracteristicas
    ? `<div class="p-mini"><div class="p-mt">Características</div>${Object.entries(f.caracteristicas)
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="p-row"><span>${k === "pH" ? "pH" : k[0].toUpperCase() + k.slice(1)}</span><b>${esc(String(v))}</b></div>`)
        .join("")}</div>`
    : "";

  // Zona de preço: só a embalagem cotada (embalagens[0]) — nunca lista os demais
  // tamanhos com valor aqui (isso é o bloco "disponíveis" acima, sem preço).
  const cotada = item.embalagens[0];
  const valores = cotada
    ? `<div class="p-val p-val-cotada"><span class="p-vic">${iconeSvg("frasco", "#fff")}</span><div class="p-vinfo"><div class="p-vl">${cotada.tamanho} ${esc(cotada.unidade)}</div><div class="p-vp">${brl(cotada.preco)}</div></div></div>`
    : "";

  // Rodapé navy da ficha (modelo refinado): slogan fixo + WhatsApp/e-mail do
  // payload (só renderiza contato que existir — nunca número fictício).
  const contatos = [
    contato?.whatsapp ? `<span class="p-ct"><span class="ic">${iconeSvg("zap", "#fff")}</span>WhatsApp ${esc(contato.whatsapp)}</span>` : "",
    contato?.emailConsultor ? `<span class="p-ct"><span class="ic">${iconeSvg("email", "#fff")}</span>${esc(contato.emailConsultor)}</span>` : "",
  ].filter(Boolean).join("");
  const rodape = `<div class="p-rodape">
    <div class="p-rq"><span class="p-rq-t">Qualidade Profissional</span><span class="p-rq-s">Resultados que transformam</span></div>
    ${contatos}
  </div>`;

  const grid = diluicoes || rendimento || embalagens || carac ? `<div class="p-grid">${diluicoes}${rendimento}${embalagens}${carac}</div>` : "";

  return `<section class="prodpg${simples ? " prodpg-simples" : semVenda ? " prodpg-sem-venda" : ""}">
    ${headerHtml}
    ${headBar}
    <div class="p-body">
      <div class="p-top">
        <div class="p-foto"><img src="${dataUri}" alt="${titulo}"/></div>
        <div class="p-main">
          <h2 class="p-tit">${titulo}</h2>${subtitulo}
          ${descricao ? `<p class="p-desc">${descricao}</p>` : ""}
          ${indicado}
          ${beneficios}
        </div>
      </div>
      ${grid}
    </div>
    <div class="p-valores"><span class="p-vtag"><span class="ic">${iconeSvg("etiqueta", "#fff")}</span>Valor</span>${valores}</div>
    <div class="p-vnota">Consulte condições especiais para compras de maiores volumes.</div>
    ${rodape}
  </section>`;
}

// Ondas orgânicas confinadas ao canto inferior direito, SEMPRE atrás do
// conteúdo (mesma arte da capa Express; pedido do Matheus: nunca invadir texto).
// `cls` escolhe o tamanho via CSS: "wave" (capa, 96mm) ou "wave wave-sec" (páginas
// internas, 60mm — menor pra não cruzar texto, com faixa de segurança no rodapé).
const wave = (cls: string) => `<svg class="${cls}" viewBox="0 0 360 300" fill="none">
  <path d="M30 250 C 90 215, 140 220, 195 168" stroke="#ccd3dc" stroke-width="1.4"/>
  <path d="M55 278 C 125 250, 170 252, 232 200" stroke="#dde2e8" stroke-width="1.2"/>
  <path d="M186 162 l 9 -1 -4 8 Z" fill="#ccd3dc"/>
  <path d="M212 226 C 252 196, 286 160, 316 106" stroke="${NAVY}" stroke-width="2.2"/>
  <path d="M310 116 l 8 -12 2 14 Z" fill="${NAVY}"/>
  <circle cx="222" cy="219" r="4" fill="${NAVY}"/>
  <circle cx="268" cy="172" r="3" fill="${NAVY}" opacity=".55"/>
  <path d="M360 128 C 302 158, 262 208, 252 300 L 360 300 Z" fill="${NAVY}"/>
  <path d="M360 114 C 296 146, 256 198, 245 300" stroke="${ORANGE}" stroke-width="3"/>
  <circle cx="236" cy="252" r="3" fill="${ORANGE}"/>
  <g fill="#fff" opacity=".85">
    <circle cx="300" cy="262" r="2"/><circle cx="313" cy="262" r="2"/><circle cx="326" cy="262" r="2"/><circle cx="339" cy="262" r="2"/>
    <circle cx="300" cy="274" r="2"/><circle cx="313" cy="274" r="2"/><circle cx="326" cy="274" r="2"/><circle cx="339" cy="274" r="2"/>
    <circle cx="300" cy="286" r="2"/><circle cx="313" cy="286" r="2"/><circle cx="326" cy="286" r="2"/><circle cx="339" cy="286" r="2"/>
  </g>
</svg>`;

// Divisor decorativo (fio + badge laranja de pessoa) usado entre blocos —
// elemento EM FLUXO, nunca posicionado por cima do conteúdo.
const divisor = `<div class="div-badge"><span class="db-fio"></span><span class="db-ic">${iconeSvg("pessoa", ORANGE)}</span><span class="db-fio"></span></div>`;

export function consolidadaHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  assets: { logo: string; fontSans: string; fontMono: string },
): string {
  const c = scope.consolidada ?? consolidadaDefaults();
  const cli = scope.cliente;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const header = (n: string) => `<div class="pg-head"><img class="hlogo" src="${assets.logo}" alt="IES"/><div class="hpg">Proposta de Solução <b>${n}</b></div></div>`;

  const cardCliente = (icone: string, rot: string, val: string) =>
    `<div class="cc-row"><span class="cc-ic">${iconeSvg(icone)}</span><div><div class="cc-r">${esc(rot)}</div><div class="cc-v">${esc(val)}</div></div></div>`;

  const capa = `<section class="capa">
    ${wave("wave")}
    <img class="capa-logo" src="${assets.logo}" alt="Indeba Express"/>
    <div class="capa-tit">PROPOSTA DE SOLUÇÃO</div>
    <div class="capa-sub">${esc(c.capa.subtitulo)}</div>
    <div class="capa-card">
      ${cardCliente("pessoa", "Cliente", cli.razaoSocial)}
      ${cardCliente("pagamento", "CNPJ", cli.cnpj || "—")}
      ${cardCliente("prazo", "Segmento", cli.segmento || "—")}
      ${cardCliente("pessoa", "Responsável", cli.responsavel || "—")}
    </div>
    <div class="capa-cons">
      <div class="capa-badge">${iconeSvg("pessoa", ORANGE)}</div>
      <div class="cc-lab">Consultor Responsável</div><div class="cc-nome">${esc(c.capa.consultor)}</div>
      <div class="capa-cal">${iconeSvg("prazo")}</div>
      <div class="cc-cidade">${esc(c.capa.cidade)}<br/>${esc(data)}</div></div>
  </section>`;

  const apres = `<section class="pg sec">
    ${wave("wave wave-sec")}
    ${header("02")}
    <h1 class="sec-tit">APRESENTAÇÃO</h1><div class="sec-sub">${esc(c.capa.subtitulo)}</div>
    <p class="sd"><b>${esc(c.apresentacao.saudacao)}</b></p>
    ${c.apresentacao.paragrafos.map((p) => `<p class="pt">${esc(p)}</p>`).join("")}
    <div class="cards">${c.apresentacao.cards
      .map((cd) => `<div class="card"><span class="card-ic">${iconeSvg(cd.icone)}</span><div class="card-t">${esc(cd.titulo)}</div><div class="card-x">${esc(cd.texto)}</div></div>`)
      .join("")}</div>
    ${divisor}
    <div class="apres-ass">
      <div class="aa-col"><div class="aa-nome">${esc(c.condicoes.consultor)}</div><div class="aa-sub">${esc(c.condicoes.cargo)}</div></div>
      <div class="aa-col"><div class="aa-nome">Indeba Express</div><div class="aa-sub">${esc(c.capa.subtitulo)}</div></div>
    </div>
  </section>`;

  const comod = `<section class="pg sec">
    ${wave("wave wave-sec")}
    ${header("03")}
    <h1 class="sec-tit">COMODATOS OFERECIDOS</h1><div class="sec-sub">Equipamentos em Comodato</div>
    <p class="pt">${esc(c.comodatos.intro)}</p>
    <div class="cards">${c.comodatos.equipamentos
      .map((e) => `<div class="card"><span class="card-ic">${iconeSvg(e.icone)}</span><div class="card-t">${esc(e.titulo)}</div>${e.descricao ? `<div class="card-x">${esc(e.descricao)}</div>` : ""}</div>`)
      .join("")}</div>
    ${divisor}
    <div class="vant-tit">VANTAGENS DO COMODATO</div>
    <div class="vant">${c.comodatos.vantagens
      .map((v) => `<div class="vant-i"><span class="vant-badge">${iconeSvg("check-simples", "#fff")}</span><div>${esc(v)}</div></div>`)
      .join("")}</div>
  </section>`;

  const contato = c.contato ?? { whatsapp: null, emailConsultor: null };
  // Numeração do header deriva do índice real (capa=01 sem header, apresentação=02,
  // comodatos=03, 1 página por produto a partir de 04) — bate com "Página X/Y" do
  // rodapé (contador nativo do Chromium), já que cada seção é garantidamente 1 página.
  const PRIMEIRO_PRODUTO = 4;
  const produtos = scope.itens
    .map((it, idx) => paginaProduto(it, imagens[it.codigo] ?? "", contato, header(String(PRIMEIRO_PRODUTO + idx).padStart(2, "0"))))
    .join("");

  const cond = `<section class="pg sec">
    ${wave("wave wave-sec")}
    ${header(String(PRIMEIRO_PRODUTO + scope.itens.length).padStart(2, "0"))}
    <h1 class="sec-tit">CONDIÇÕES COMERCIAIS</h1><div class="sec-sub">Informações Gerais da Proposta</div>
    <div class="cond-wrap">
      <div class="cond-list">${c.condicoes.itens
        .map((i) => `<div class="cond-i"><span class="cond-ic">${iconeSvg(i.icone)}</span><div><div class="cond-t">${esc(i.titulo)}</div><div class="cond-x">${esc(i.texto)}</div></div></div>`)
        .join("")}</div>
      <div class="cond-close"><p>${esc(c.condicoes.mensagemFechamento)}</p><div class="cc-sep"></div>
        <div class="cc-at">Atenciosamente,</div><div class="cc-nome">${esc(c.condicoes.consultor)}</div>
        <div class="cc-cargo">${esc(c.condicoes.cargo)}</div>
        ${contato.emailConsultor ? `<div class="cc-contato"><span class="ic">${iconeSvg("email")}</span>${esc(contato.emailConsultor)}</div>` : ""}
        ${contato.whatsapp ? `<div class="cc-contato"><span class="ic">${iconeSvg("zap")}</span>${esc(contato.whatsapp)}</div>` : ""}
        <div class="cc-emp">Indeba Express</div>
        <div class="cc-emp-sub">${esc(c.capa.subtitulo)}</div></div>
    </div>
  </section>`;

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>
/* Tipografia da marca (Geist/Geist Mono — mesma da plataforma, tokens/typography.css
   do skill indeba-design). Fonte de arquivo (variável), embutida como data-URI: o
   render bloqueia requisição externa, então CDN não funciona aqui. */
@font-face { font-family: "Geist"; src: url("${assets.fontSans}") format("woff2"); font-weight: 100 900; font-display: swap; }
@font-face { font-family: "Geist Mono"; src: url("${assets.fontMono}") format("woff2"); font-weight: 100 900; font-display: swap; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Geist", "Segoe UI", Arial, sans-serif; color: #2a3746; font-size: 11.5px; }
.pg { padding: 14px 16mm 0; position: relative; }
/* Cada seção é UMA página — altura FIXA (não auto): sem isso, se o conteúdo de uma seção
   passar de 1 página impressa (ex.: comodatos com mais itens), o box CSS cresce além da
   página física e a onda (position:absolute;bottom:0, ancorada nesse box) passa a flutuar
   no meio/cortar — porque "bottom" nesse caso não é mais o rodapé da página real, é o fim
   de um box que já vazou pra página seguinte. 278mm ≈ A4 (297mm) menos a margem inferior do
   PDF (15mm, render.ts) menos folga de segurança; overflow:hidden é o cinto-e-suspensório
   se algum conteúdo ainda assim passar do previsto (fica invisível, não mancha a página seguinte). */
.sec { page-break-after: always; overflow: hidden; padding-bottom: 28mm; height: 278mm; }
.sec:last-of-type { page-break-after: auto; }
/* Onda decorativa das páginas internas: SEMPRE atrás do conteúdo (mesma regra da capa) —
   28mm de faixa de segurança acima (padding-bottom do .sec) garante que texto nunca encoste. */
.sec > *:not(.wave-sec) { position: relative; z-index: 1; }
.wave.wave-sec { width: 30mm; } /* especificidade > .wave sozinho — .wave define 96mm mais abaixo (capa) */
.pg-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5ebf2; padding-bottom: 8px; margin-bottom: 18px; }
.hlogo { height: 34px; } .hpg { color: #7a8696; font-size: 11px; } .hpg b { color: ${NAVY}; }
.sec-tit { color: ${NAVY}; font-size: 30px; font-weight: 800; letter-spacing: -.5px; }
.sec-sub { color: ${ORANGE}; font-weight: 700; font-size: 13px; margin: 2px 0 14px; }
.sec-tit::before { content: ""; display: block; width: 46px; height: 5px; background: ${ORANGE}; border-radius: 3px; margin-bottom: 12px; }
.sd { margin: 6px 0 10px; } .pt { color: #4a5768; line-height: 1.6; margin-bottom: 10px; }
.cards { display: flex; gap: 12px; margin-top: 18px; }
.card { flex: 1; border: 1px solid #e5ebf2; border-radius: 12px; padding: 16px 12px; text-align: center; }
.card-ic { display: inline-flex; width: 46px; height: 46px; border-radius: 50%; background: ${NAVY}; align-items: center; justify-content: center; margin-bottom: 10px; }
.card-ic svg { width: 22px; height: 22px; stroke: #fff; } .card-t { color: ${NAVY}; font-weight: 800; font-size: 11.5px; text-transform: uppercase; }
.card-x { color: #6b7787; font-size: 10px; line-height: 1.4; margin-top: 6px; }
.vant-tit { text-align: center; color: ${NAVY}; font-weight: 800; letter-spacing: 1px; margin: 20px 0 14px; }
.vant { display: flex; gap: 10px; } .vant-i { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; color: #6b7787; font-size: 10px; }
.vant-badge { display: inline-flex; width: 28px; height: 28px; border-radius: 50%; background: ${ORANGE}; align-items: center; justify-content: center; margin-bottom: 8px; }
.vant-badge svg { width: 15px; height: 15px; }
.ic-ok svg { width: 18px; height: 18px; } .ic { display: inline-flex; vertical-align: middle; }
/* Divisor decorativo em fluxo (fio + badge laranja) */
.div-badge { display: flex; align-items: center; gap: 14px; margin-top: 26px; }
.db-fio { flex: 1; height: 1px; background: #e5ebf2; }
.db-ic { flex: none; width: 36px; height: 36px; border: 1.5px solid ${ORANGE}; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
.db-ic svg { width: 17px; height: 17px; }
/* Assinatura da Apresentação — ABAIXO dos cards, com folga (nunca colide) */
.apres-ass { display: flex; justify-content: space-around; margin-top: 20px; text-align: center; }
.aa-nome { color: ${NAVY}; font-weight: 800; font-size: 13px; }
.aa-sub { color: #8a95a3; font-size: 11px; margin-top: 2px; }
/* Capa — decorativos SEMPRE atrás do conteúdo (z-index) e confinados ao canto */
.capa { height: 275mm; position: relative; display: flex; flex-direction: column; align-items: center; padding-top: 60px; padding-bottom: 110px; page-break-after: always; overflow: hidden; }
.capa > * { position: relative; z-index: 1; }
.wave { position: absolute; z-index: 0; right: 0; bottom: 0; width: 96mm; height: auto; }
.capa-badge { width: 36px; height: 36px; border: 1.5px solid ${ORANGE}; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.capa-badge svg { width: 17px; height: 17px; }
.capa-cal { margin-top: 22px; } .capa-cal svg { width: 20px; height: 20px; }
.capa-logo { width: 200px; margin-bottom: 40px; }
.capa-tit { color: ${NAVY}; font-size: 26px; font-weight: 800; letter-spacing: 4px; }
.capa-sub { color: #6b7787; font-size: 13px; margin-top: 6px; }
.capa-card { background: #fff; border: 1px solid #eef2f7; border-radius: 16px; box-shadow: 0 8px 30px rgba(11,42,74,.08); padding: 18px 26px; margin-top: 40px; width: 340px; }
.cc-row { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f3f7; }
.cc-row:last-child { border-bottom: none; } .cc-ic { width: 38px; height: 38px; border-radius: 50%; background: ${NAVY}; display: inline-flex; align-items: center; justify-content: center; }
.cc-ic svg { width: 18px; height: 18px; stroke: #fff; } .cc-r { color: #8a95a3; font-size: 9.5px; } .cc-v { color: ${NAVY}; font-weight: 800; font-size: 13px; }
.capa-cons { text-align: center; margin-top: 40px; } .cc-lab { color: #8a95a3; font-size: 11px; }
.cc-nome { color: ${NAVY}; font-weight: 800; font-size: 14px; margin-top: 2px; } .cc-cidade { color: #6b7787; font-size: 11px; margin-top: 28px; }
/* Condições */
.cond-wrap { display: flex; gap: 20px; } .cond-list { flex: 1.2; }
.cond-i { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f3f7; }
.cond-ic { width: 40px; height: 40px; border-radius: 10px; background: ${NAVY}; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 40px; }
.cond-ic svg { width: 18px; height: 18px; stroke: #fff; } .cond-t { color: ${NAVY}; font-weight: 800; font-size: 12px; }
.cond-x { color: #6b7787; font-size: 10px; line-height: 1.4; }
.cond-close { flex: 1; background: #f7f9fc; border-radius: 14px; padding: 20px; text-align: center; color: #5a6878; font-size: 11px; }
.cc-sep { width: 40px; height: 4px; background: ${ORANGE}; border-radius: 2px; margin: 14px auto; } .cc-at { margin-bottom: 8px; }
.cc-cargo { color: #8a95a3; font-size: 10px; } .cc-emp { color: ${NAVY}; font-weight: 800; margin-top: 8px; }
.cc-contato { display: flex; align-items: center; justify-content: center; gap: 6px; color: #5a6878; font-size: 10.5px; margin-top: 6px; }
.cc-contato .ic svg { width: 13px; height: 13px; }
.cc-emp-sub { color: #8a95a3; font-size: 10px; margin-top: 2px; }
/* Página de produto — min-height abaixo da área útil (282mm) para a barra de
   valores + contato nunca estourarem sobre o rodapé da página. */
.prodpg { padding: 0 0 6mm; position: relative; page-break-after: always; min-height: 272mm; display: flex; flex-direction: column; }
.prodpg > .pg-head { padding: 14px 16mm 0; } /* mesma .pg-head das outras seções — aqui sem o padding herdado de .pg */
/* Corpo (foto+info+grid) cresce para ocupar a página e centraliza verticalmente — sem isso,
   produtos com pouca ficha (sem indicado-para/benefícios) deixavam a metade de baixo vazia.
   VALOR e rodapé ficam ancorados no fim da página. */
.p-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.p-head { background: ${NAVY}; height: 46px; display: flex; align-items: center; justify-content: flex-end; padding: 0 16mm; }
.p-badge { color: #fff; font-size: 12px; letter-spacing: 2px; } .p-badge b { color: ${ORANGE}; }
.p-top { display: flex; gap: 18px; padding: 20px 16mm 0; }
.p-foto { flex: 0 0 165px; height: 235px; background: #f2f6fa; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.p-foto img { max-width: 140px; max-height: 215px; object-fit: contain; }
/* Produto simples (sem ficha rica): centraliza o pouco conteúdo na página em vez de
   empilhar tudo no topo e deixar a metade de baixo vazia; foto bem maior, texto mais
   respirado — em vez de encolher a página, ocupa mais dela com o que já existe. */
.prodpg-simples { display: flex; flex-direction: column; justify-content: center; }
.prodpg-simples .p-top { align-items: center; gap: 32px; }
.prodpg-simples .p-foto { flex: 0 0 340px; height: 440px; }
.prodpg-simples .p-foto img { max-width: 290px; max-height: 420px; }
.prodpg-simples .p-tit { font-size: 30px; }
.prodpg-simples .p-desc { font-size: 15px; line-height: 1.9; margin: 20px 0; }
.prodpg-simples .p-valores { margin-top: 40px; }
.prodpg-simples .p-valores .p-vtag { padding: 20px 26px; }
.prodpg-simples .p-vp { font-size: 26px; }
/* Meio-termo: tem grid técnico (características/rendimento/diluição) mas falta
   indicado-para/benefícios — foto um pouco maior para não sobrar vazio ao lado do
   texto curto, mas mantém o grid técnico completo abaixo (diferente do "simples"). */
.prodpg-sem-venda .p-top { align-items: center; gap: 28px; }
.prodpg-sem-venda .p-foto { flex: 0 0 260px; height: 340px; }
.prodpg-sem-venda .p-foto img { max-width: 220px; max-height: 320px; }
.prodpg-sem-venda .p-desc { font-size: 13px; line-height: 1.7; }
.p-main { flex: 1; } .p-tit { color: ${NAVY}; font-size: 24px; font-weight: 800; line-height: 1.1; }
.p-sub { color: ${ORANGE}; font-weight: 700; font-size: 15px; margin-top: 2px; }
.p-desc { color: #4a5768; line-height: 1.5; margin: 12px 0; }
.p-block { margin-top: 12px; } .p-bt { color: #fff; background: ${NAVY}; display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
.p-ind { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; } .p-ic { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; font-size: 9px; color: #6b7787; width: 64px; }
/* Caixa fixa e centralizada por ícone (não o SVG esticado 1:1 no espaço) — o desenho de
   cada glifo ocupa uma área diferente dentro do viewBox 24×24 (ex.: "restaurante" usa quase
   o quadro inteiro, "padaria" fica mais recolhido); sem essa margem uniforme, o ícone com
   glifo maior encosta na borda enquanto os outros sobram folga. Nunca fica com folga zero. */
.p-ic .ic { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; }
.p-ic .ic svg { width: 22px; height: 22px; } .p-ben { list-style: none; margin-top: 10px; }
.p-ben li { display: flex; align-items: center; gap: 8px; color: #3a4757; font-size: 11px; padding: 3px 0; }
/* Grid técnico: centralizado e com largura de card limitada — assim 1-2 cards ficam
   com tamanho natural (não esticam a página inteira com o valor jogado na borda),
   e 3-4 cards preenchem a largura como no mockup de referência. */
.p-grid { display: flex; flex-wrap: wrap; gap: 12px; padding: 18px 16mm 0; justify-content: center; }
.p-mini { flex: 1 1 190px; max-width: 320px; border: 1px solid #e5ebf2; border-radius: 10px; padding: 12px 14px; }
.p-mt { color: ${NAVY}; font-weight: 800; font-size: 9.5px; text-transform: uppercase; text-align: center; margin-bottom: 8px; }
.p-row { display: flex; justify-content: space-between; font-size: 10px; color: #4a5768; padding: 3px 0; } .p-row b { color: ${NAVY}; }
.p-big { text-align: center; color: ${ORANGE}; font-weight: 800; font-size: 13px; }
/* Rendimento multi-dosagem (Sanquat, Sanclor, Sanap…): lista legível em vez de paredão
   laranja centralizado. Dose em destaque, contexto (entre parênteses) em cinza abaixo. */
.p-rlist { list-style: none; }
.p-rlist li { padding: 4px 0; border-top: 1px solid #f0f3f7; }
.p-rlist li:first-child { border-top: none; padding-top: 0; }
.p-rlist li b { display: block; color: ${ORANGE}; font-weight: 800; font-size: 10px; }
.p-rlist li span { display: block; color: #6b7787; font-size: 9px; line-height: 1.35; margin-top: 1px; }
/* Barra VALOR (modelo refinado, ref. ficha-mockup): tag laranja + painel NAVY com
   ícone de frasco, tamanho em laranja e preço em branco — premium, não faixa clara. */
.p-valores { display: flex; align-items: stretch; margin: 18px 16mm 0; background: ${NAVY}; border-radius: 12px; overflow: hidden; page-break-inside: avoid; }
.p-vtag { background: ${ORANGE}; color: #fff; font-weight: 800; display: flex; align-items: center; gap: 9px; padding: 16px 26px; text-transform: uppercase; letter-spacing: 1px; }
.p-vtag .ic svg { width: 18px; height: 18px; stroke: #fff; }
.p-val { flex: 1; text-align: center; padding: 12px 6px; }
.p-vl { font-size: 10px; color: #9fb2c8; text-transform: uppercase; letter-spacing: 1px; }
.p-vp { font-family: "Geist Mono", monospace; font-size: 20px; font-weight: 700; color: #fff; }
/* Única embalagem cotada (spec §3/§8): ícone de frasco + tamanho (laranja) e preço (branco),
   alinhados como no mockup de referência. */
.p-val-cotada { flex: 1; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px 6px; }
.p-vic { display: inline-flex; } .p-vic svg { width: 34px; height: 34px; stroke: #fff; }
.p-vinfo { text-align: left; }
.p-val-cotada .p-vl { color: ${ORANGE}; font-weight: 700; }
.p-val-cotada .p-vp { font-size: 26px; color: #fff; }
.p-vnota { text-align: center; color: #8a95a3; font-size: 9.5px; margin: 6px 16mm 0; }
/* Rodapé navy da ficha — reservado no fim da página, nunca sobrepõe a barra */
.p-rodape { display: flex; align-items: center; justify-content: space-between; gap: 18px; background: ${NAVY}; color: #fff; margin: 10px 16mm 0; border-radius: 10px; padding: 10px 16px; page-break-inside: avoid; }
.p-rq { display: flex; flex-direction: column; }
.p-rq-t { font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; }
.p-rq-s { font-size: 9px; opacity: .75; text-transform: uppercase; letter-spacing: .5px; }
.p-ct { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; } .p-ct .ic svg { width: 14px; height: 14px; }
</style></head><body>
${capa}
${apres}
${comod}
${produtos}
${cond}
</body></html>`;
}
