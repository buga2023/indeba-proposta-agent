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

// Uma página A4 rica por produto — rail navy (marca/foto/preço) + coluna de conteúdo
// (texto/specs). `numero` é só o número de página ("06"), nunca HTML pronto — o
// runmark "Proposta de Solução NN" é montado aqui, igual às outras seções (mesmo
// texto, só reposicionado). `simples`/`semVenda`: sinalizam o quão rica é a ficha
// (nenhum dado técnico/venda vs. só técnico) — o layout em rail já centraliza o
// conteúdo disponível sozinho, então essas classes hoje são só um sinal semântico.
export function paginaProduto(item: PropostaItem, dataUri: string, contato?: ContatoConsolidada, numero?: string, logoWhite?: string): string {
  const f = item.ficha ?? null;
  const titulo = f?.titulo ? esc(f.titulo) : esc(item.nome);
  const subtitulo = f?.subtitulo ? `<div class="pp-sub">${esc(f.subtitulo)}</div>` : "";
  const eyebrow = f?.linhaLabel ? `<div class="pp-eyebrow">LINHA<b>${esc(f.linhaLabel)}</b></div>` : ""; // sem linha → sem eyebrow vazio
  const descricao = esc(f?.descricao || item.descricaoUso || "");
  // Diluição: a ficha rica (indicadoPara/benefícios/características/rendimento) é dado de
  // catálogo que só existe pra alguns produtos (Primmax Plus/DGClor) — não inventamos pros
  // outros. Mas a EMBALAGEM já carrega diluicaoMax/custoDiluido pra vários produtos "simples"
  // (ex.: Primmax LDF, Primmax Hort) e o template não lia isso — dado real, só não estava sendo
  // usado aqui (é lido em template.ts pro modelo Express).
  const diluicaoEmbalagem = item.embalagens.find((e) => e.diluicaoMax);
  const simples = !f?.indicadoPara?.length && !f?.beneficios?.length && !f?.diluicoes?.length && !diluicaoEmbalagem && !f?.caracteristicas && !f?.rendimento;
  const semVenda = !simples && !f?.indicadoPara?.length && !f?.beneficios?.length;

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

  const diluicoes = f?.diluicoes?.length
    ? `<div class="pp-panel"><h4>Modo de diluição</h4><div class="pp-rows">${f.diluicoes
        .map((d) => `<div class="pp-row"><span class="k">${esc(d.uso)}</span><span class="v">${esc(d.razao)}</span></div>`)
        .join("")}</div></div>`
    : diluicaoEmbalagem
      ? `<div class="pp-panel"><h4>Modo de diluição</h4><div class="pp-rows">
          <div class="pp-row"><span class="k">Diluição máxima</span><span class="v">${esc(diluicaoEmbalagem.diluicaoMax!)}</span></div>
          ${diluicaoEmbalagem.custoDiluido ? `<div class="pp-row"><span class="k">Custo/litro diluído</span><span class="v">${brl(diluicaoEmbalagem.custoDiluido)}</span></div>` : ""}
        </div></div>`
      : "";
  const rendimento = f?.rendimento
    ? `<div class="pp-panel"><h4>Rendimento aproximado</h4>${fmtRendimento(f.rendimento)}</div>`
    : "";
  // Embalagem cotada = SEMPRE embalagens[0] (mesma convenção do resto do app —
  // preço/subtotal na revisão/dashboard também usam a primeira). "Disponíveis" lista
  // TODOS os tamanhos do produto (ficha técnica), incluindo a cotada, sem preço — spec
  // §8, decisão final do cliente (áudio 16:24): repetir não é problema, pois a lista vem
  // da ficha técnica; o único valor que aparece em qualquer lugar do card é o da cotada,
  // no bloco de Valor da rail. Ordenada por volume crescente (L convertido pra ml
  // equivalente, já que alguns produtos misturam L/ml nas embalagens — ex.: Letah Gel).
  const volumeOrdenacao = (e: (typeof item.embalagens)[number]) => (e.unidade === "L" ? e.tamanho * 1000 : e.tamanho);
  const disponiveis = item.embalagens.length > 1 ? [...item.embalagens].sort((a, b) => volumeOrdenacao(a) - volumeOrdenacao(b)) : [];
  const embalagens = disponiveis.length
    ? `<div class="pp-panel"><h4>Embalagens disponíveis</h4><div class="pp-emb">${disponiveis
        .map((e) => `<span class="pp-emb-chip">${e.tamanho} ${esc(e.unidade)}</span>`)
        .join("")}</div></div>`
    : "";
  const carac = f?.caracteristicas
    ? `<div class="pp-panel"><h4>Características</h4><div class="pp-rows-cols">${Object.entries(f.caracteristicas)
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="pp-row"><span class="k">${k === "pH" ? "pH" : k[0].toUpperCase() + k.slice(1)}</span><span class="v">${esc(String(v))}</span></div>`)
        .join("")}</div></div>`
    : "";

  // Zona de preço: só a embalagem cotada (embalagens[0]) — nunca lista os demais
  // tamanhos com valor aqui (isso é o bloco "disponíveis" acima, sem preço).
  const cotada = item.embalagens[0];
  const valores = cotada
    ? `<div class="pp-price"><div class="pp-v-label">Valor</div><div class="pp-v-row"><span class="pp-v-size">${cotada.tamanho} ${esc(cotada.unidade)}</span><span class="pp-v-price">${brl(cotada.preco)}</span></div><p class="pp-v-note">Consulte condições especiais para compras de maiores volumes.</p></div>`
    : "";

  // Rodapé da ficha: slogan fixo + WhatsApp/e-mail do payload (só renderiza contato
  // que existir — nunca número fictício).
  const contatos = [
    contato?.whatsapp ? `<span class="pp-c-item"><span class="ic">${iconeSvg("zap", ORANGE)}</span>WhatsApp ${esc(contato.whatsapp)}</span>` : "",
    contato?.emailConsultor ? `<span class="pp-c-item"><span class="ic">${iconeSvg("email", ORANGE)}</span>${esc(contato.emailConsultor)}</span>` : "",
  ].filter(Boolean).join("");

  const specs = diluicoes || rendimento || embalagens || carac ? `<div class="pp-specs">${diluicoes}${rendimento}${embalagens}${carac}</div>` : "";
  const runmark = numero ? `<div class="pp-runmark">Proposta de Solução <b>${esc(numero)}</b></div>` : "";
  const railFoot = numero ? `<div class="pp-railfoot">Página ${esc(numero)} · Proposta de Solução</div>` : "";

  const wm = logoWhite
    ? `<img class="pp-wm-logo" src="${logoWhite}" alt="Indeba Express"/>`
    : `<div class="pp-wm"><b>indeba</b><span>express</span><i>.</i></div>`;

  return `<section class="prodpg${simples ? " prodpg-simples" : semVenda ? " prodpg-sem-venda" : ""}">
    <aside class="pp-rail">
      ${wm}
      ${eyebrow}
      <div class="pp-figure"><div class="pp-imgcard"><img src="${dataUri}" alt="${titulo}"/></div></div>
      ${valores}
      ${railFoot}
    </aside>
    <div class="pp-content">
      ${runmark}
      <div class="pp-main">
        <div>
          <h2 class="pp-tit">${titulo}</h2>${subtitulo}
          ${descricao ? `<p class="pp-desc">${descricao}</p>` : ""}
        </div>
        ${indicado}
        ${beneficios}
        ${specs}
      </div>
      <div class="pp-contact">
        <div class="pp-c-left"><b>Qualidade Profissional</b><span>Resultados que transformam</span></div>
        <div class="pp-c-right">${contatos}</div>
      </div>
    </div>
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

export function consolidadaHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  assets: { logo: string; logoWhite: string; fontSans: string; fontMono: string },
): string {
  const c = scope.consolidada ?? consolidadaDefaults();
  const cli = scope.cliente;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const header = (n: string) => `<div class="pg-head"><img class="hlogo" src="${assets.logo}" alt="IES"/><div class="hpg">Proposta de Solução <b>${n}</b></div></div>`;
  // Eyebrow (dash + rótulo em caixa alta) acima do título grande de cada seção —
  // título passa a vir em title case (estilo atualizado); o rótulo em caixa alta
  // preserva a convenção antiga de nomear a seção em maiúsculas.
  const secLbl = (rotulo: string) => `<div class="lbl"><span></span><b>${esc(rotulo)}</b></div>`;

  const capaRow = (icone: string, rot: string, val: string) =>
    `<div class="cc-row"><span class="cc-ic">${iconeSvg(icone)}</span><div><div class="cc-r">${esc(rot)}</div><div class="cc-v">${esc(val)}</div></div></div>`;

  const capa = `<section class="capa">
    ${wave("wave")}
    <div class="capa-wm">indeba express</div>
    <img class="capa-logo" src="${assets.logo}" alt="Indeba Express"/>
    <div class="capa-dash"></div>
    <div class="capa-tit">PROPOSTA DE SOLUÇÃO</div>
    <div class="capa-sub">${esc(c.capa.subtitulo)}</div>
    <div class="capa-card">
      ${capaRow("pessoa", "Cliente", cli.razaoSocial)}
      ${capaRow("pagamento", "CNPJ", cli.cnpj || "—")}
      ${capaRow("prazo", "Segmento", cli.segmento || "—")}
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
    ${wave("wave wave-sec")}
    ${header("02")}
    ${secLbl("APRESENTAÇÃO")}
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
    ${wave("wave wave-sec")}
    ${header("03")}
    ${secLbl("COMODATOS OFERECIDOS")}
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
  // rodapé (contador nativo do Chromium), já que cada seção é garantidamente 1 página.
  const PRIMEIRO_PRODUTO = 4;
  const produtos = scope.itens
    .map((it, idx) =>
      paginaProduto(it, imagens[it.codigo] ?? "", contato, String(PRIMEIRO_PRODUTO + idx).padStart(2, "0"), assets.logoWhite),
    )
    .join("");

  const cond = `<section class="pg sec">
    ${wave("wave wave-sec")}
    ${header(String(PRIMEIRO_PRODUTO + scope.itens.length).padStart(2, "0"))}
    ${secLbl("CONDIÇÕES COMERCIAIS")}
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
.hlogo { height: 46px; } .hpg { color: #7a8696; font-size: 11px; } .hpg b { color: ${NAVY}; }
.sec-tit { color: ${NAVY}; font-size: 30px; font-weight: 800; letter-spacing: -.5px; }
.sec-sub { color: ${ORANGE}; font-weight: 700; font-size: 13px; margin: 2px 0 14px; }
.sd { margin: 6px 0 10px; } .pt { color: #4a5768; line-height: 1.6; margin-bottom: 10px; }
.ic { display: inline-flex; vertical-align: middle; }
/* Eyebrow (fio + rótulo em caixa alta) acima do título grande de cada seção —
   substitui o antigo ::before isolado na h1; título abaixo agora em title case. */
.lbl { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
.lbl span { width: 16px; height: 3px; background: ${ORANGE}; border-radius: 2px; }
.lbl b { font-size: 11px; font-weight: 700; letter-spacing: 1.6px; color: ${NAVY}; text-transform: uppercase; }
/* Apresentação — cards "pill" (ícone + título + texto lado a lado) */
.pillars { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
.pill { background: #eef2f7; border-radius: 14px; padding: 16px; display: flex; gap: 12px; align-items: flex-start; }
.pill .pi { width: 38px; height: 38px; flex: none; border-radius: 10px; background: ${NAVY}; display: flex; align-items: center; justify-content: center; }
.pill .pi svg { width: 19px; height: 19px; }
.pill h3 { color: ${NAVY}; font-weight: 800; font-size: 12.5px; }
.pill p { color: #6b7787; font-size: 10.5px; line-height: 1.45; margin-top: 4px; }
/* Assinatura da Apresentação — simples divisor superior, sem badge */
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px solid #e5ebf2; padding-top: 16px; margin-top: 20px; }
.sign .n { color: ${NAVY}; font-weight: 800; font-size: 14px; }
.sign .r { color: #8a95a3; font-size: 11px; margin-top: 2px; }
/* Comodatos — equipamentos em tile maior + painel navy de vantagens */
.equip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
.eq { background: #eef2f7; border-radius: 14px; padding: 20px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.eq .ei { width: 46px; height: 46px; border-radius: 12px; background: ${NAVY}; display: flex; align-items: center; justify-content: center; }
.eq .ei svg { width: 22px; height: 22px; }
.eq h3 { color: ${NAVY}; font-weight: 700; font-size: 11px; line-height: 1.3; }
.eq p { color: #6b7787; font-size: 9.5px; line-height: 1.4; }
.adv { background: ${NAVY}; border-radius: 16px; padding: 22px 26px; color: #fff; margin-top: 20px; }
.adv h4 { text-align: center; font-weight: 700; font-size: 11px; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(255,255,255,.85); margin-bottom: 16px; }
.adv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.av { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.av .chk { width: 26px; height: 26px; border-radius: 50%; background: ${ORANGE}; display: flex; align-items: center; justify-content: center; flex: none; }
.av .chk svg { width: 14px; height: 14px; }
.av span { font-size: 9.5px; line-height: 1.4; color: rgba(255,255,255,.82); }
/* Capa — fundo claro (padrão validado), decorativos SEMPRE atrás do conteúdo */
.capa { height: 275mm; position: relative; display: flex; flex-direction: column; align-items: center;
  padding-top: 60px; padding-bottom: 110px; page-break-after: always; overflow: hidden; background: #f6f7f9; }
.capa > *:not(.wave):not(.capa-wm) { position: relative; z-index: 1; }
.wave { position: absolute; z-index: 0; right: 0; bottom: 0; width: 96mm; height: auto; }
/* Marca-d'água gigante atrás do card — decorativa, nunca disputa leitura com o conteúdo */
.capa-wm { position: absolute; z-index: 0; top: 46%; left: 50%; transform: translate(-50%, -50%);
  font-size: 68px; font-weight: 800; color: ${NAVY}; opacity: .045; white-space: nowrap; letter-spacing: -1px; }
.capa-logo { width: 190px; margin-bottom: 22px; }
.capa-dash { width: 46px; height: 2px; background: ${ORANGE}; position: relative; margin-bottom: 14px; }
.capa-dash::before, .capa-dash::after { content: ""; position: absolute; top: -5px; width: 2px; height: 12px; background: ${ORANGE}; }
.capa-dash::before { left: -2px; } .capa-dash::after { right: -2px; }
.capa-tit { color: ${NAVY}; font-size: 26px; font-weight: 800; letter-spacing: 4px; }
.capa-sub { color: #6b7787; font-size: 13px; margin-top: 6px; }
.capa-card { background: #fff; border: 1px solid #eef2f7; border-radius: 16px; box-shadow: 0 8px 30px rgba(11,42,74,.08); padding: 18px 26px; margin-top: 40px; width: 340px; }
.cc-row { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f3f7; }
.cc-row:last-child { border-bottom: none; } .cc-ic { width: 38px; height: 38px; border-radius: 50%; background: ${NAVY}; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.cc-ic svg { width: 18px; height: 18px; stroke: #fff; } .cc-r { color: #8a95a3; font-size: 9.5px; } .cc-v { color: ${NAVY}; font-weight: 800; font-size: 13px; }
.capa-cons { text-align: center; margin-top: 40px; }
.capa-cons-row { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
.capa-fio { width: 70px; height: 1px; } .capa-fio-l { background: linear-gradient(90deg, transparent, ${ORANGE}); }
.capa-fio-r { background: linear-gradient(90deg, ${ORANGE}, transparent); }
.capa-badge { width: 36px; height: 36px; border: 1.5px solid ${ORANGE}; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.capa-badge svg { width: 17px; height: 17px; }
.cc-lab { color: #8a95a3; font-size: 11px; margin-top: 10px; }
.cc-nome { color: ${NAVY}; font-weight: 800; font-size: 14px; margin-top: 2px; }
.capa-cal { margin-top: 22px; } .capa-cal svg { width: 20px; height: 20px; }
.cc-cidade { color: #6b7787; font-size: 11px; margin-top: 13px; }
/* Condições — grid 2 colunas de itens + fechamento navy (mensagem + assinatura) */
.conds { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 28px; margin-top: 18px; }
.condi { display: flex; gap: 12px; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid #e5ebf2; }
.condi .ci { width: 34px; height: 34px; flex: none; border-radius: 10px; background: #eef2f7; display: flex; align-items: center; justify-content: center; }
.condi .ci svg { width: 17px; height: 17px; }
.condi h3 { color: ${NAVY}; font-weight: 700; font-size: 11.5px; }
.condi p { color: #6b7787; font-size: 9.5px; line-height: 1.45; margin-top: 3px; }
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
.prodpg { height: 278mm; overflow: hidden; page-break-after: always; display: flex; }
.pp-rail { width: 79mm; flex: none; color: #fff; background: linear-gradient(165deg, ${NAVY} 0%, #06203f 100%);
  display: flex; flex-direction: column; padding: 32px 26px 26px; }
.pp-wm { font-size: 17px; letter-spacing: .2px; }
.pp-wm b { font-weight: 800; } .pp-wm span { font-weight: 400; opacity: .8; margin-left: 3px; }
.pp-wm i { color: ${ORANGE}; font-style: normal; }
.pp-wm-logo { height: 32px; width: auto; align-self: flex-start; display: block; }
.pp-eyebrow { margin-top: 12px; font-size: 10px; letter-spacing: 2.4px; color: rgba(255,255,255,.55); text-transform: uppercase; }
.pp-eyebrow b { color: ${ORANGE}; font-weight: 700; margin-left: 6px; }
.pp-figure { flex: 1; display: flex; align-items: center; justify-content: center; padding: 16px 0; }
.pp-imgcard { width: 190px; height: 190px; background: #f3f6fa; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
.pp-imgcard img { max-width: 150px; max-height: 170px; object-fit: contain; }
.pp-price { border-top: 1px solid rgba(255,255,255,.16); padding-top: 16px; }
.pp-v-label { font-size: 9.5px; letter-spacing: 2.4px; color: rgba(255,255,255,.55); text-transform: uppercase; }
.pp-v-row { display: flex; align-items: baseline; gap: 10px; margin-top: 7px; }
.pp-v-size { font-size: 12px; font-weight: 700; color: ${ORANGE}; letter-spacing: .5px; }
.pp-v-price { font-family: "Geist Mono", monospace; font-size: 27px; font-weight: 700; letter-spacing: .3px; }
.pp-v-note { font-size: 9px; line-height: 1.4; color: rgba(255,255,255,.5); margin-top: 8px; max-width: 200px; }
.pp-railfoot { margin-top: 14px; font-size: 8.5px; letter-spacing: 1.2px; color: rgba(255,255,255,.4); text-transform: uppercase; }
/* Coluna de conteúdo: centraliza o bloco principal verticalmente — sem isso,
   produtos com pouca ficha (sem indicado-para/benefícios) deixavam a metade de
   baixo vazia. Contato fica ancorado no fim da página. */
.pp-content { flex: 1; padding: 30px 34px 24px; display: flex; flex-direction: column; }
.pp-runmark { align-self: flex-end; font-size: 9.5px; letter-spacing: 1px; color: #9aa3ae; text-transform: uppercase; }
.pp-runmark b { color: ${NAVY}; }
.pp-main { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
.pp-tit { color: ${NAVY}; font-size: 25px; font-weight: 800; line-height: 1.08; letter-spacing: -.3px; }
.pp-sub { color: ${ORANGE}; font-weight: 700; font-size: 13px; margin-top: 4px; }
.pp-desc { color: #5a6878; font-size: 11.5px; line-height: 1.55; max-width: 400px; }
.pp-label { display: inline-block; background: ${NAVY}; color: #fff; font-size: 10px; font-weight: 700;
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
.pp-panel h4 { color: ${NAVY}; font-size: 9px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase;
  text-align: center; padding-bottom: 8px; margin-bottom: 9px; border-bottom: 1px solid #e0e6ee; }
.pp-emb { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.pp-emb-chip { display: inline-block; font-family: "Geist Mono", monospace; font-weight: 700; font-size: 12px; color: ${NAVY};
  background: #fff; border: 1px solid #d6dee8; border-radius: 8px; padding: 7px 16px; }
/* Diluição pode ter frases longas (uso e razão) — coluna única sempre, com
   k/v nas pontas (space-between); em duas colunas estreitas o texto colide.
   Características (valores curtos: "Líquido", "Amarelo") ganha grid 2 colunas
   à parte (.pp-rows-cols), com k/v coladinhos — space-between ali jogaria o
   valor pra ponta da célula, longe da chave. */
.pp-rows { display: flex; flex-direction: column; gap: 6px; }
.pp-rows-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
.pp-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; }
.pp-row .k { color: #6b7787; } .pp-row .v { font-weight: 700; color: ${NAVY}; text-align: right; }
.pp-rows-cols .pp-row { justify-content: flex-start; }
.pp-rows-cols .pp-row .k { flex: none; } .pp-rows-cols .pp-row .v { text-align: left; }
.pp-big { text-align: center; color: ${ORANGE}; font-weight: 800; font-size: 12px; }
/* Rendimento multi-dosagem (Sanquat, Sanclor, Sanap…): lista legível em vez de paredão
   laranja centralizado. Dose em destaque, contexto (entre parênteses) em cinza abaixo. */
.pp-rlist { list-style: none; }
.pp-rlist li { padding: 3px 0; border-top: 1px solid #e0e6ee; }
.pp-rlist li:first-child { border-top: none; padding-top: 0; }
.pp-rlist li b { display: block; color: ${ORANGE}; font-weight: 800; font-size: 9.5px; }
.pp-rlist li span { display: block; color: #6b7787; font-size: 8.5px; line-height: 1.3; margin-top: 1px; }
.pp-contact { border-top: 1px solid #e5ebf2; padding-top: 13px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.pp-c-left b { display: block; font-size: 9.5px; font-weight: 700; letter-spacing: 1px; color: ${NAVY}; text-transform: uppercase; }
.pp-c-left span { font-size: 8.5px; letter-spacing: .5px; color: #9aa3ae; text-transform: uppercase; }
.pp-c-right { display: flex; gap: 14px; flex-wrap: wrap; justify-content: flex-end; }
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
