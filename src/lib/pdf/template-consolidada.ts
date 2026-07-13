import type { PropostaItem, PropostaScope } from "../contracts";
import { consolidadaDefaults } from "../consolidada-defaults";

export const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const brl = (v: string) =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  validade: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12l2 2 4-4"/>',
  prazo: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  pagamento: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  frete: '<path d="M1 7h13v10H1zM14 10h5l3 3v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
};
export const iconeSvg = (nome: string, cor = NAVY): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome] ?? '<circle cx="12" cy="12" r="3"/>'}</svg>`;

// Uma página A4 rica por produto. Cada bloco só aparece se o dado existir.
export function paginaProduto(item: PropostaItem, dataUri: string, pageNum: number): string {
  const f = item.ficha ?? null;
  const titulo = f?.titulo ? esc(f.titulo) : esc(item.nome);
  const subtitulo = f?.subtitulo ? `<div class="p-sub">${esc(f.subtitulo)}</div>` : "";
  const badge = f?.linhaLabel ? `<span class="p-badge">LINHA <b>${esc(f.linhaLabel)}</b></span>` : "";
  const numero = `<span class="p-num">Proposta de Solução <b>${String(pageNum).padStart(2, "0")}</b></span>`;
  const descricao = esc(f?.descricao || item.descricaoUso || "");

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
    : "";
  const rendimento = f?.rendimento
    ? `<div class="p-mini"><div class="p-mt">Rendimento aproximado</div><div class="p-big">${esc(f.rendimento)}</div></div>`
    : "";
  const embalagens = item.embalagens.length
    ? `<div class="p-mini"><div class="p-mt">Embalagens disponíveis</div>${item.embalagens
        .map((e) => `<div class="p-row"><span>${e.tamanho} ${esc(e.unidade)}</span></div>`)
        .join("")}</div>`
    : "";
  const carac = f?.caracteristicas
    ? `<div class="p-mini"><div class="p-mt">Características</div>${Object.entries(f.caracteristicas)
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="p-row"><span>${k === "pH" ? "pH" : k[0].toUpperCase() + k.slice(1)}</span><b>${esc(String(v))}</b></div>`)
        .join("")}</div>`
    : "";

  const valores = item.embalagens
    .map((e) => `<div class="p-val"><div class="p-vl">${e.tamanho} ${esc(e.unidade)}</div><div class="p-vp">${brl(e.preco)}</div></div>`)
    .join("");

  return `<section class="prodpg">
    <div class="p-head">${numero}${badge}</div>
    <div class="p-top">
      <div class="p-foto"><img src="${dataUri}" alt="${titulo}"/></div>
      <div class="p-main">
        <h2 class="p-tit">${titulo}</h2>${subtitulo}
        ${descricao ? `<p class="p-desc">${descricao}</p>` : ""}
        ${indicado}
        ${beneficios}
      </div>
    </div>
    <div class="p-grid">${diluicoes}${rendimento}${embalagens}${carac}</div>
    <div class="p-valores"><span class="p-vtag">Valor</span>${valores}</div>
  </section>`;
}

const wave = `<svg class="wave" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 60 Q120 10 260 50 T400 40 L400 120 L0 120 Z" fill="${NAVY}"/><path d="M0 78 Q120 30 260 68 T400 58" fill="none" stroke="${ORANGE}" stroke-width="3"/></svg>`;

export function consolidadaHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  assets: { logo: string },
): string {
  const c = scope.consolidada ?? consolidadaDefaults();
  const cli = scope.cliente;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const header = (n: string) => `<div class="pg-head"><img class="hlogo" src="${assets.logo}" alt="IES"/><div class="hpg">Proposta de Solução <b>${n}</b></div></div>`;

  const cardCliente = (icone: string, rot: string, val: string) =>
    `<div class="cc-row"><span class="cc-ic">${iconeSvg(icone)}</span><div><div class="cc-r">${esc(rot)}</div><div class="cc-v">${esc(val)}</div></div></div>`;

  const capa = `<section class="capa">
    ${wave}
    <img class="capa-logo" src="${assets.logo}" alt="Indeba Express"/>
    <div class="capa-tit">PROPOSTA DE SOLUÇÃO</div>
    <div class="capa-sub">${esc(c.capa.subtitulo)}</div>
    <div class="capa-card">
      ${cardCliente("pessoa", "Cliente", cli.razaoSocial)}
      ${cardCliente("pagamento", "CNPJ", cli.cnpj || "—")}
      ${cardCliente("prazo", "Segmento", cli.segmento || "—")}
      ${cardCliente("pessoa", "Responsável", cli.responsavel || "—")}
    </div>
    <div class="capa-cons"><div class="cc-lab">Consultor Responsável</div><div class="cc-nome">${esc(c.capa.consultor)}</div>
      <div class="cc-cidade">${esc(c.capa.cidade)}<br/>${esc(data)}</div></div>
  </section>`;

  const apres = `<section class="pg sec">
    ${header("02")}
    <h1 class="sec-tit">APRESENTAÇÃO</h1><div class="sec-sub">${esc(c.capa.subtitulo)}</div>
    <p class="sd"><b>${esc(c.apresentacao.saudacao)}</b></p>
    ${c.apresentacao.paragrafos.map((p) => `<p class="pt">${esc(p)}</p>`).join("")}
    <div class="cards">${c.apresentacao.cards
      .map((cd) => `<div class="card"><span class="card-ic">${iconeSvg(cd.icone)}</span><div class="card-t">${esc(cd.titulo)}</div><div class="card-x">${esc(cd.texto)}</div></div>`)
      .join("")}</div>
  </section>`;

  const comod = `<section class="pg sec">
    ${header("03")}
    <h1 class="sec-tit">COMODATOS OFERECIDOS</h1><div class="sec-sub">Equipamentos em Comodato</div>
    <p class="pt">${esc(c.comodatos.intro)}</p>
    <div class="cards">${c.comodatos.equipamentos
      .map((e) => `<div class="card"><span class="card-ic">${iconeSvg(e.icone)}</span><div class="card-t">${esc(e.titulo)}</div><div class="card-x">${esc(e.descricao)}</div></div>`)
      .join("")}</div>
    <div class="vant-tit">VANTAGENS DO COMODATO</div>
    <div class="vant">${c.comodatos.vantagens
      .map((v) => `<div class="vant-i"><span class="ic ic-ok">${iconeSvg("check", ORANGE)}</span>${esc(v)}</div>`)
      .join("")}</div>
  </section>`;

  // 02 apresentação, 03 comodatos, 04..(04+N-1) páginas de produto, condições fecha a sequência —
  // antes "04" vinha hardcoded pra condições e não contava as páginas de produto (rótulo errado
  // quando havia mais de um item; ver docs/superpowers/plans/2026-07-10-proposta-consolidada.md).
  const produtos = scope.itens.map((it, i) => paginaProduto(it, imagens[it.codigo] ?? "", 4 + i)).join("");
  const numCondicoes = String(4 + scope.itens.length).padStart(2, "0");

  const cond = `<section class="pg sec">
    ${header(numCondicoes)}
    <h1 class="sec-tit">CONDIÇÕES COMERCIAIS</h1><div class="sec-sub">Informações Gerais da Proposta</div>
    <div class="cond-wrap">
      <div class="cond-list">${c.condicoes.itens
        .map((i) => `<div class="cond-i"><span class="cond-ic">${iconeSvg(i.icone)}</span><div><div class="cond-t">${esc(i.titulo)}</div><div class="cond-x">${esc(i.texto)}</div></div></div>`)
        .join("")}</div>
      <div class="cond-close"><p>${esc(c.condicoes.mensagemFechamento)}</p><div class="cc-sep"></div>
        <div class="cc-at">Atenciosamente,</div><div class="cc-nome">${esc(c.condicoes.consultor)}</div>
        <div class="cc-cargo">${esc(c.condicoes.cargo)}</div><div class="cc-emp">Indeba Express</div></div>
    </div>
  </section>`;

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #2a3746; font-size: 11.5px; }
.pg { padding: 14px 16mm 0; position: relative; }
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
.vant-tit { text-align: center; color: ${NAVY}; font-weight: 800; letter-spacing: 1px; margin: 26px 0 14px; }
.vant { display: flex; gap: 10px; } .vant-i { flex: 1; text-align: center; color: #6b7787; font-size: 10px; }
.ic-ok svg { width: 18px; height: 18px; } .ic { display: inline-flex; vertical-align: middle; }
/* Capa */
.capa { height: 275mm; position: relative; display: flex; flex-direction: column; align-items: center; padding-top: 60px; page-break-after: always; overflow: hidden; }
.wave { position: absolute; bottom: 0; left: 0; width: 100%; height: 130px; }
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
/* Página de produto */
.prodpg { padding: 0 0 0; position: relative; page-break-after: always; min-height: 272mm; }
.p-head { background: ${NAVY}; height: 46px; display: flex; align-items: center; justify-content: space-between; padding: 0 16mm; }
.p-badge { color: #fff; font-size: 12px; letter-spacing: 2px; } .p-badge b { color: ${ORANGE}; }
.p-num { color: #b9c6d6; font-size: 11px; } .p-num b { color: #fff; }
.p-top { display: flex; gap: 18px; padding: 20px 16mm 0; }
.p-foto { flex: 0 0 210px; height: 300px; background: #f2f6fa; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.p-foto img { max-width: 180px; max-height: 280px; object-fit: contain; }
.p-main { flex: 1; } .p-tit { color: ${NAVY}; font-size: 24px; font-weight: 800; line-height: 1.1; }
.p-sub { color: ${ORANGE}; font-weight: 700; font-size: 15px; margin-top: 2px; }
.p-desc { color: #4a5768; line-height: 1.5; margin: 12px 0; }
.p-block { margin-top: 12px; } .p-bt { color: #fff; background: ${NAVY}; display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
.p-ind { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; } .p-ic { text-align: center; font-size: 9px; color: #6b7787; width: 64px; }
.p-ic .ic svg { width: 26px; height: 26px; } .p-ben { list-style: none; margin-top: 10px; }
.p-ben li { display: flex; align-items: center; gap: 8px; color: #3a4757; font-size: 11px; padding: 3px 0; }
.p-grid { display: flex; gap: 12px; padding: 18px 16mm 0; }
.p-mini { flex: 1; border: 1px solid #e5ebf2; border-radius: 10px; padding: 10px; }
.p-mt { color: ${NAVY}; font-weight: 800; font-size: 9.5px; text-transform: uppercase; text-align: center; margin-bottom: 8px; }
.p-row { display: flex; justify-content: space-between; font-size: 10px; color: #4a5768; padding: 3px 0; } .p-row b { color: ${NAVY}; }
.p-big { text-align: center; color: ${ORANGE}; font-weight: 800; font-size: 13px; }
.p-valores { display: flex; align-items: center; gap: 20px; margin: 20px 16mm 0; background: ${NAVY}; border-radius: 12px; padding: 14px 20px; }
.p-vtag { background: ${ORANGE}; color: #fff; font-weight: 800; padding: 6px 16px; border-radius: 8px; text-transform: uppercase; }
.p-val { text-align: center; color: #fff; } .p-vl { font-size: 10px; opacity: .8; } .p-vp { font-size: 20px; font-weight: 800; }
</style></head><body>
${capa}
${apres}
${comod}
${produtos}
${cond}
</body></html>`;
}
