import type { PropostaScope } from "../contracts";
import { segmentosLegiveis } from "../segmento";

// Capa "Proposta de Solução" — marca Indeba Express. Espelha a spec
// Especificacao_Capa_Proposta_Indeba_Express.md: A4 branco, logo no topo,
// marca d'água central, card com Cliente/CNPJ/Segmento/Responsável, bloco do
// consultor + cidade/data e ondas decorativas no canto inferior direito.
// Fontes: a spec pede Montserrat/Open Sans, mas o render bloqueia rede
// (nada externo carrega) — usamos a pilha de sistema dos demais templates.

const AZUL = "#0C355E";
const LARANJA = "#F58220";
const CINZA_CLARO = "#EAEAEA";
const CINZA_TEXTO = "#6B7280";

// Mesmos dados fixos usados na assinatura do template Express (template.ts).
const CONSULTOR = "Matheus Resende";
const CIDADE = "Salvador – BA";

export type CapaExpressAssets = { logo?: string; simbolo?: string };

// Cópia local (mesmo padrão de template-comercial.ts) — evita import circular
// com template.ts, que importa esta capa.
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Ícones circulares azuis do card (linha 1.8px, estilo Lucide, como na UI).
const icone = (paths: string) =>
  `<span class="cx-ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;

const IC_PESSOA = icone('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.8-5.4 7-5.4s6.2 1.8 7 5.4"/>');
const IC_DOC = icone('<rect x="5.5" y="3.5" width="13" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>');
const IC_PASTA = icone('<rect x="3.5" y="8" width="17" height="12" rx="2"/><path d="M9 8V6.2A2.2 2.2 0 0 1 11.2 4h1.6A2.2 2.2 0 0 1 15 6.2V8"/><path d="M3.5 13h17"/>');
const IC_CALENDARIO = '<svg class="cx-cal" viewBox="0 0 24 24" fill="none" stroke="' + AZUL + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M8 3v5M16 3v5M4 11h16"/></svg>';

function linha(ic: string, rotulo: string, valor: string | null): string {
  return `<div class="cx-row">${ic}<div class="cx-tx"><div class="cx-lbl">${rotulo}</div><div class="cx-val">${valor ? esc(valor) : "—"}</div></div></div>`;
}

// Ondas orgânicas azul/laranja + linhas de fluxo + pontos (canto inferior direito).
const ONDAS = `<svg class="cx-ondas" viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 250 C 90 215, 140 220, 195 168" stroke="#ccd3dc" stroke-width="1.4"/>
  <path d="M55 278 C 125 250, 170 252, 232 200" stroke="#dde2e8" stroke-width="1.2"/>
  <path d="M186 162 l 9 -1 -4 8 Z" fill="#ccd3dc"/>
  <path d="M212 226 C 252 196, 286 160, 316 106" stroke="${AZUL}" stroke-width="2.2"/>
  <path d="M310 116 l 8 -12 2 14 Z" fill="${AZUL}"/>
  <circle cx="222" cy="219" r="4" fill="${AZUL}"/>
  <circle cx="268" cy="172" r="3" fill="${AZUL}" opacity=".55"/>
  <path d="M360 128 C 302 158, 262 208, 252 300 L 360 300 Z" fill="${AZUL}"/>
  <path d="M360 114 C 296 146, 256 198, 245 300" stroke="${LARANJA}" stroke-width="3"/>
  <circle cx="236" cy="252" r="3" fill="${LARANJA}"/>
  <g fill="#fff" opacity=".85">
    <circle cx="300" cy="262" r="2"/><circle cx="313" cy="262" r="2"/><circle cx="326" cy="262" r="2"/><circle cx="339" cy="262" r="2"/>
    <circle cx="300" cy="274" r="2"/><circle cx="313" cy="274" r="2"/><circle cx="326" cy="274" r="2"/><circle cx="339" cy="274" r="2"/>
    <circle cx="300" cy="286" r="2"/><circle cx="313" cy="286" r="2"/><circle cx="326" cy="286" r="2"/><circle cx="339" cy="286" r="2"/>
  </g>
</svg>`;

export function capaExpressHtml(scope: PropostaScope, assets: CapaExpressAssets = {}): string {
  const c = scope.cliente;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const logo = assets.logo
    ? `<img class="cx-logo" src="${assets.logo}" alt="Indeba Express"/>`
    : `<div class="cx-logo-txt">índeba <span>express</span></div>`;
  const marcaDagua = assets.simbolo ? `<img class="cx-marca" src="${assets.simbolo}" alt=""/>` : "";

  return `<section class="capa-x">
    ${marcaDagua}
    ${logo}
    <div class="cx-titulo-bloco">
      <div class="cx-fio"></div>
      <h1 class="cx-titulo">Proposta de Solução</h1>
      <div class="cx-sub">Soluções em Higienização Profissional</div>
      <div class="cx-fio"></div>
    </div>
    <div class="cx-card">
      ${linha(IC_PESSOA, "Cliente", c.razaoSocial)}
      ${linha(IC_DOC, "CNPJ", c.cnpj)}
      ${linha(IC_PASTA, "Segmento", segmentosLegiveis(c.segmento) || null)}
      ${linha(IC_PESSOA, "Responsável", c.responsavel)}
    </div>
    <div class="cx-rodape">
      <div class="cx-consultor">
        <div class="cx-divisor"><span class="cx-fio-l"></span><span class="cx-ic-lar"><svg viewBox="0 0 24 24" fill="none" stroke="${LARANJA}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.8-5.4 7-5.4s6.2 1.8 7 5.4"/></svg></span><span class="cx-fio-l"></span></div>
        <div class="cx-lbl">Consultor Responsável</div>
        <div class="cx-nome">${esc(CONSULTOR)}</div>
      </div>
      <div class="cx-local">
        ${IC_CALENDARIO}
        <div class="cx-cidade">${esc(CIDADE)}</div>
        <div class="cx-data">${esc(data)}</div>
      </div>
    </div>
    ${ONDAS}
  </section>`;
}

export function capaExpressCss(): string {
  return `
.capa-x { position: relative; height: 272mm; overflow: hidden; background: #fff;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 16mm 24mm 10mm; page-break-after: always; }
.capa-x > * { position: relative; z-index: 1; }
.cx-marca { position: absolute; z-index: 0 !important; top: 44%; left: 50%; transform: translate(-50%, -50%);
  width: 70%; opacity: .07; }
.cx-logo { width: 42mm; margin-top: 14mm; }
.cx-logo-txt { margin-top: 8mm; color: ${AZUL}; font-size: 26px; font-weight: 800; letter-spacing: -.5px; }
.cx-logo-txt span { color: ${LARANJA}; }
/* Título */
.cx-titulo-bloco { margin-top: 18mm; display: flex; flex-direction: column; align-items: center; gap: 9px; }
.cx-fio { width: 46px; height: 1.5px; background: ${LARANJA}; }
.cx-titulo { color: ${AZUL}; font-size: 26px; font-weight: 700; text-transform: uppercase; letter-spacing: 6px; }
.cx-sub { color: ${AZUL}; font-size: 14px; font-weight: 500; }
/* Card central */
.cx-card { margin-top: 16mm; width: 104mm; background: #fff; border: 1px solid #f1f3f6; border-radius: 16px;
  box-shadow: 0 10px 34px rgba(12, 53, 94, .12); padding: 4mm 9mm; text-align: left; }
.cx-row { display: flex; align-items: center; gap: 14px; padding: 4.6mm 0; border-bottom: 1px solid ${CINZA_CLARO}; }
.cx-row:last-child { border-bottom: none; }
.cx-ic { flex: none; width: 34px; height: 34px; border-radius: 50%; background: ${AZUL};
  display: flex; align-items: center; justify-content: center; }
.cx-ic svg { width: 18px; height: 18px; }
.cx-tx { min-width: 0; }
.cx-lbl { color: ${CINZA_TEXTO}; font-size: 10.5px; }
.cx-val { color: ${AZUL}; font-size: 14.5px; font-weight: 700; margin-top: 1px; }
/* Bloco inferior: consultor + cidade/data */
.cx-rodape { margin-top: auto; display: flex; flex-direction: column; align-items: center; }
.cx-divisor { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.cx-fio-l { width: 80px; height: 1px; background: ${LARANJA}; opacity: .7; }
.cx-ic-lar { width: 30px; height: 30px; border: 1.5px solid ${LARANJA}; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; }
.cx-ic-lar svg { width: 16px; height: 16px; }
.cx-nome { color: ${AZUL}; font-size: 15px; font-weight: 700; margin-top: 2px; }
.cx-local { margin-top: 9mm; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.cx-cal { width: 20px; height: 20px; margin-bottom: 3px; }
.cx-cidade { color: ${AZUL}; font-size: 12.5px; font-weight: 600; }
.cx-data { color: ${AZUL}; font-size: 12.5px; }
/* Ondas decorativas */
.cx-ondas { position: absolute; z-index: 0 !important; right: 0; bottom: 0; width: 96mm; }
`;
}
