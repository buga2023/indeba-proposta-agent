import type { PropostaScope, PropostaItem } from "../contracts";

// Tipo "implantacao" — formato Indeba Express, FIEL ao Modelo A (docs/estrutura-modelos.md,
// ref: Proposta GVA): cabeçalho banner navy + título centralizado · bloco cliente em barras
// creme (Cliente/Responsável/Data) · 1 PRODUTO POR PÁGINA (foto grande + barras creme:
// valor da embalagem, valor por litro diluído, observações de ficha técnica) · fechamento
// (Diluidores Seko Pro Max + painel de fichas técnicas/EPI) · assinatura. Sem tabela formal
// de condições (o Express não traz — os termos vêm do orçamento).

const MARCAS = {
  indeba_express: { nome: "INDEBA EXPRESS", navy: "#16335c", azul: "#1f5fae", laranja: "#ef7d1a", titulo: "Proposta de Implantação" },
  indeba: { nome: "INDEBA", navy: "#0b3d24", azul: "#0b6b3a", laranja: "#7cb342", titulo: "Proposta de Implantação" },
} as const;

// Escapa para texto E atributos (campos do PropostaScope chegam do cliente em /api/pdf).
export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
// Decimal sem "R$" — as barras do Modelo A já trazem o rótulo "R$:".
const dec = (v: string) =>
  Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Marca = (typeof MARCAS)[keyof typeof MARCAS];
type ExtraAssets = { seko?: string; painelEpi?: string };

// 1 produto por página (Modelo A). Foto grande centralizada + barras creme.
function produtoPagina(item: PropostaItem, idx: number, dataUri: string, m: Marca, primeiro: boolean): string {
  const barras = item.embalagens
    .map((emb) => {
      const valor = `<div class="cbar"><span class="o">o</span> Valor embalagem de <b>${emb.tamanho} ${emb.unidade}</b> R$: <b>${dec(emb.preco)}</b></div>`;
      const dil =
        emb.custoDiluido && emb.diluicaoMax
          ? `<div class="cbar"><span class="o">o</span> Valor por litro diluído (Diluição de até <b>${esc(emb.diluicaoMax)}</b>) R$: <b>${dec(emb.custoDiluido)}</b></div>`
          : "";
      return valor + dil;
    })
    .join("");

  return `<section class="prod-pg" style="${primeiro ? "" : "page-break-before: always;"}">
    <div class="prod-nome">${idx + 1}. Item: ${esc(item.nome)} – ${esc(item.descricaoUso.toUpperCase())}</div>
    <div class="prod-foto"><img src="${dataUri}" alt="${esc(item.nome)}"/></div>
    <div class="prod-barras">
      ${barras}
      <div class="cbar"><span class="o">o</span> Observações: Para mais informações solicitar ficha técnica. A diluição máxima indicada é teórica; na prática pode variar de 1:10, 1:20, 1:50 a depender da sujidade.</div>
    </div>
  </section>`;
}

// PropostaScope → HTML (Modelo A Express). `assets` traz imagens opcionais do
// fechamento (Seko Pro Max / painel EPI); sem elas, cai num bloco textual.
export function documentoHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  banner: string,
  assets: ExtraAssets = {},
): string {
  const m = MARCAS[scope.template];
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");
  const cabecalho = banner
    ? `<img class="banner" src="${banner}" alt="${m.nome}"/>`
    : `<div class="banner-txt">${m.nome}</div>`;

  const itens = scope.itens.map((it, i) => produtoPagina(it, i, imagens[it.codigo] ?? "", m, i === 0)).join("");

  const fechamentoSeko = assets.seko
    ? `<img class="fech-img" src="${assets.seko}" alt="Diluidores Seko Pro Max"/>`
    : `<div class="fech-box"><div class="fech-ph">Diluidor Seko Pro Max</div></div>`;
  const fechamentoEpi = assets.painelEpi
    ? `<img class="fech-img" src="${assets.painelEpi}" alt="Fichas técnicas e EPI"/>`
    : `<div class="fech-box"><div class="fech-ph">Painel de fichas técnicas &amp; EPI</div></div>`;

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>${css(m)}</style></head><body>
    ${cabecalho}
    <div class="pg">
      <h1 class="titulo">${m.titulo}</h1>

      <section class="cli-bars">
        <div class="bar"><span class="lbl">Cliente</span><span class="val">${esc(scope.cliente.razaoSocial)}</span></div>
        <div class="bar"><span class="lbl">Responsável</span><span class="val">Matheus Resende</span></div>
        <div class="bar"><span class="lbl">Data</span><span class="val">${data}</span></div>
      </section>

      ${scope.textoApresentacao.conteudo ? `<p class="apresentacao">${esc(scope.textoApresentacao.conteudo)}</p>` : ""}

      ${itens}

      <section class="fechamento">
        <h2 class="fech-titulo">Diluidores Seko Pro Max</h2>
        ${fechamentoSeko}
        <h2 class="fech-titulo">Fichas técnicas e informações de EPI</h2>
        ${fechamentoEpi}
        <p class="assinatura">Atenciosamente,<br/><strong>Matheus Resende</strong> · (71) 99196-2650<br/>
        <span class="end">Rua Cosme de Farias, 05 — Galpão 01, Boca do Rio, Salvador — BA · CEP 41710-010</span></p>
      </section>
    </div>
  </body></html>`;
}

function css(m: Marca): string {
  const creme = "#FBF6E9";
  const cremeBorda = "#E9DEC2";
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #25303f; font-size: 12px; -webkit-font-smoothing: antialiased; }
.banner { display: block; width: 100%; }
.banner-txt { background: ${m.navy}; color: #fff; font-size: 24px; font-weight: 800; letter-spacing: 1px; padding: 18px 12mm; }
.pg { padding: 18px 14mm 0; }

/* Título centralizado */
.titulo { color: ${m.navy}; font-size: 24px; font-weight: 800; text-align: center; letter-spacing: .3px; margin: 10px 0 18px; }
.titulo::after { content: ""; display: block; width: 70px; height: 4px; background: ${m.laranja}; border-radius: 2px; margin: 8px auto 0; }

/* Bloco cliente em barras creme */
.cli-bars { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
.cli-bars .bar { background: ${creme}; border: 1px solid ${cremeBorda}; border-left: 4px solid ${m.laranja};
  border-radius: 0 6px 6px 0; padding: 8px 14px; display: flex; gap: 12px; align-items: baseline; }
.cli-bars .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .6px; color: #8a7a4f; font-weight: 700; min-width: 90px; }
.cli-bars .val { font-size: 13px; font-weight: 700; color: ${m.navy}; }

.apresentacao { line-height: 1.6; text-align: justify; color: #3a4757; margin-bottom: 10px; }

/* 1 produto por página */
.prod-pg { padding-top: 8px; break-inside: avoid; }
.prod-nome { color: ${m.azul}; font-size: 15px; font-weight: 800; line-height: 1.4; margin-bottom: 14px; }
.prod-foto { text-align: center; margin: 6px 0 18px; }
.prod-foto img { max-width: 280px; max-height: 300px; object-fit: contain; }
.prod-barras { display: flex; flex-direction: column; gap: 8px; }
.cbar { background: ${creme}; border: 1px solid ${cremeBorda}; border-radius: 6px; padding: 9px 14px; font-size: 12px; color: #3a4757; line-height: 1.5; }
.cbar .o { color: ${m.laranja}; font-weight: 800; margin-right: 6px; }
.cbar b { color: ${m.navy}; }

/* Fechamento */
.fechamento { page-break-before: always; padding-top: 8px; }
.fech-titulo { color: ${m.navy}; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px;
  border-bottom: 2px solid #e6ecf4; padding-bottom: 5px; margin: 14px 0 12px; }
.fech-img { display: block; max-width: 100%; max-height: 320px; margin: 0 auto 8px; object-fit: contain; }
.fech-box { background: ${creme}; border: 1.5px dashed ${cremeBorda}; border-radius: 10px; height: 150px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.fech-ph { color: #b6a880; font-size: 13px; font-weight: 700; }
.assinatura { color: #4a5868; line-height: 1.6; font-size: 12px; margin-top: 22px; }
.assinatura strong { color: ${m.navy}; }
.assinatura .end { font-size: 10px; color: #7a8696; }
`;
}
