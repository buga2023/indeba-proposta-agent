import type { PropostaScope, PropostaItem } from "../contracts";
import { capaExpressHtml, capaExpressCss } from "./capa-express";
import { tamanhoLegivel } from "../embalagem";
import { chaveImagem } from "../imagem-produto";

// Tipo "implantacao" — Indeba Express, visual da spec da capa
// (Especificacao_Capa_Proposta_Indeba_Express.md): branco premium, azul
// institucional + laranja, cards arredondados com sombra suave e ícones
// circulares. Estrutura do Modelo A preservada: capa · cabeçalho · bloco
// cliente · 1 PRODUTO POR PÁGINA (foto grande + valores) · fechamento
// (Diluidores Seko Pro Max + fichas/EPI) · assinatura. Sem tabela de
// condições (o Express não traz — os termos vêm do orçamento).

const MARCAS = {
  indeba_express: { nome: "INDEBA EXPRESS", navy: "#0C355E", laranja: "#F58220", titulo: "Proposta de Implantação" },
  indeba: { nome: "INDEBA", navy: "#0b3d24", laranja: "#7cb342", titulo: "Proposta de Implantação" },
} as const;

// Escapa para texto E atributos (campos do PropostaScope chegam do cliente em /api/pdf).
export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const dec = (v: string) =>
  Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Quem assina o Express. Sai do `scope.consultor` — quem montou a proposta, ou para quem
 * ela foi transferida. Antes era a string "Matheus Resende · (71) 99196-2650" chumbada
 * aqui: toda proposta de Orçamento/Implantação saía com esse nome, independentemente do
 * consultor (achado no teste em produção de 02/09/2026). Propostas anteriores ao campo
 * não têm o dado — para elas o texto antigo continua valendo, senão a assinatura sumiria
 * de um histórico inteiro.
 */
export const CONSULTOR_PADRAO = { nome: "Matheus Resende", telefone: "(71) 99196-2650" };

export function assinaturaConsultor(scope: PropostaScope): string {
  const c = scope.consultor;
  if (!c) return `${CONSULTOR_PADRAO.nome} · ${CONSULTOR_PADRAO.telefone}`;
  return c.telefone ? `${c.nome} · ${c.telefone}` : c.nome;
}

type Marca = (typeof MARCAS)[keyof typeof MARCAS];
type ExtraAssets = { seko?: string; painelEpi?: string; logoExpress?: string; simboloExpress?: string };

// Ícone circular (estilo da capa): fundo na cor da marca, traço branco 1.8px.
const icone = (fundo: string, paths: string) =>
  `<span class="v-ic" style="background:${fundo}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;

const P_CAIXA = '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>';
const P_GOTA = '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>';
const P_INFO = '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.4"/>';
const P_PESSOA = '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.8-5.4 7-5.4s6.2 1.8 7 5.4"/>';
const P_CALENDARIO = '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M8 3v5M16 3v5M4 11h16"/>';

// Linha de valor do card do produto: ícone circular + rótulo cinza + valor navy.
const linhaValor = (m: Marca, paths: string, rotulo: string, valor: string) =>
  `<div class="vrow">${icone(m.navy, paths)}<div class="v-tx"><div class="v-lbl">${rotulo}</div><div class="v-val">${valor}</div></div></div>`;

// 1 produto por página. Cabeçalho numerado + foto grande + card de valores.
function produtoPagina(item: PropostaItem, idx: number, dataUri: string, m: Marca, primeiro: boolean): string {
  const linhas = item.embalagens
    .map((emb) => {
      const valor = linhaValor(m, P_CAIXA, `Valor da embalagem de ${esc(tamanhoLegivel(emb.tamanho, emb.unidade))}`, `R$ ${dec(emb.preco)}`);
      const dil =
        emb.custoDiluido && emb.diluicaoMax
          ? linhaValor(m, P_GOTA, `Valor por litro diluído — diluição de até ${esc(emb.diluicaoMax)}`, `R$ ${dec(emb.custoDiluido)}`)
          : "";
      return valor + dil;
    })
    .join("");

  return `<section class="prod-pg" style="${primeiro ? "" : "page-break-before: always;"}">
    <div class="prod-head">
      <span class="prod-num">${idx + 1}</span>
      <div>
        <div class="prod-nome">${esc(item.nome)}</div>
        ${item.descricaoUso ? `<div class="prod-uso">${esc(item.descricaoUso)}</div>` : ""}
      </div>
    </div>
    <div class="prod-foto"><img src="${dataUri}" alt="${esc(item.nome)}"/></div>
    <div class="card">
      ${linhas}
      <div class="vrow">${icone(m.laranja, P_INFO)}<div class="v-tx"><div class="v-lbl">Observações</div><div class="v-obs">Para mais informações solicitar ficha técnica. A diluição máxima indicada é teórica; na prática pode variar de 1:10, 1:20, 1:50 a depender da sujidade.</div></div></div>
    </div>
  </section>`;
}

// PropostaScope → HTML (Express premium). `assets` traz o logo colorido (cabeçalho
// clean das páginas) e imagens opcionais do fechamento; sem elas, blocos textuais.
export function documentoHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  banner: string,
  assets: ExtraAssets = {},
): string {
  const m = MARCAS[scope.template];
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");
  const express = scope.template === "indeba_express";

  // Express: cabeçalho clean no padrão da capa (logo colorido + fio laranja).
  // Marca indeba (sem logo colorido): mantém o banner/faixa.
  const cabecalho =
    express && assets.logoExpress
      ? `<div class="head-clean"><img src="${assets.logoExpress}" alt="${m.nome}"/></div>`
      : banner
        ? `<img class="banner" src="${banner}" alt="${m.nome}"/>`
        : `<div class="banner-txt">${m.nome}</div>`;

  const itens = scope.itens.map((it, i) => produtoPagina(it, i, imagens[chaveImagem(it)] ?? "", m, i === 0)).join("");

  // Capa "Proposta de Solução" (spec da capa Express) — só para a marca Express.
  const capa = express ? capaExpressHtml(scope, { logo: assets.logoExpress, simbolo: assets.simboloExpress }) : "";

  const fechamentoSeko = assets.seko
    ? `<img class="fech-img" src="${assets.seko}" alt="Diluidores Seko Pro Max"/>`
    : `<div class="fech-box"><div class="fech-ph">Diluidor Seko Pro Max</div></div>`;
  const fechamentoEpi = assets.painelEpi
    ? `<img class="fech-img" src="${assets.painelEpi}" alt="Fichas técnicas e EPI"/>`
    : `<div class="fech-box"><div class="fech-ph">Painel de fichas técnicas &amp; EPI</div></div>`;

  const responsavel = scope.cliente.responsavel ?? "Matheus Resende";

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>${css(m)}${capa ? capaExpressCss() : ""}</style></head><body>
    ${capa}
    ${cabecalho}
    <div class="pg">
      <h1 class="titulo">${m.titulo}</h1>

      <section class="card cli-card">
        <div class="vrow">${icone(m.navy, P_PESSOA)}<div class="v-tx"><div class="v-lbl">Cliente</div><div class="v-val">${esc(scope.cliente.razaoSocial)}</div></div></div>
        <div class="vrow">${icone(m.navy, P_PESSOA)}<div class="v-tx"><div class="v-lbl">Responsável</div><div class="v-val">${esc(responsavel)}</div></div></div>
        <div class="vrow">${icone(m.navy, P_CALENDARIO)}<div class="v-tx"><div class="v-lbl">Data</div><div class="v-val">${data}</div></div></div>
      </section>

      ${scope.textoApresentacao.conteudo ? `<p class="apresentacao">${esc(scope.textoApresentacao.conteudo)}</p>` : ""}

      ${itens}

      <section class="fechamento">
        <h2 class="secao">Diluidores Seko Pro Max</h2>
        ${fechamentoSeko}
        <h2 class="secao">Fichas técnicas e informações de EPI</h2>
        ${fechamentoEpi}
        <div class="card assinatura">
          ${icone(m.laranja, P_PESSOA)}
          <div class="v-tx">
            <div class="v-lbl">Atenciosamente</div>
            <div class="v-val">${esc(assinaturaConsultor(scope))}</div>
            <div class="ass-end">Rua Cosme de Farias, 05 — Galpão 01, Boca do Rio, Salvador — BA · CEP 41710-010</div>
          </div>
        </div>
      </section>
    </div>
  </body></html>`;
}

function css(m: Marca): string {
  const cinzaTexto = "#6B7280";
  const cinzaLinha = "#EAEAEA";
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #25303f; font-size: 12px; -webkit-font-smoothing: antialiased; }
.banner { display: block; width: 100%; }
.banner-txt { background: ${m.navy}; color: #fff; font-size: 24px; font-weight: 800; letter-spacing: 1px; padding: 18px 12mm; }
.head-clean { padding: 6mm 14mm 4mm; border-bottom: 2px solid ${m.laranja}; }
.head-clean img { width: 30mm; display: block; }
.pg { padding: 18px 14mm 0; }

/* Título centralizado com fio laranja (padrão da capa) */
.titulo { color: ${m.navy}; font-size: 22px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 4px; margin: 12px 0 6px; }
.titulo::after { content: ""; display: block; width: 46px; height: 1.5px; background: ${m.laranja}; margin: 10px auto 0; }

/* Card branco arredondado com sombra suave (linguagem da capa) */
.card { background: #fff; border: 1px solid #f1f3f6; border-radius: 16px; box-shadow: 0 6px 22px rgba(12, 53, 94, .10); padding: 4mm 8mm; }
.vrow { display: flex; align-items: center; gap: 12px; padding: 3.2mm 0; border-bottom: 1px solid ${cinzaLinha}; }
.vrow:last-child { border-bottom: none; }
.v-ic { flex: none; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.v-ic svg { width: 16px; height: 16px; }
.v-tx { min-width: 0; flex: 1; }
.v-lbl { color: ${cinzaTexto}; font-size: 10px; }
.v-val { color: ${m.navy}; font-size: 13.5px; font-weight: 700; margin-top: 1px; }
.v-obs { color: #3a4757; font-size: 10.5px; line-height: 1.5; margin-top: 1px; }

/* Bloco cliente: card com 3 colunas enxutas */
.cli-card { display: flex; gap: 10mm; margin: 14px 0 14px; }
.cli-card .vrow { border-bottom: none; padding: 1.5mm 0; flex: 1; min-width: 0; }

.apresentacao { line-height: 1.65; text-align: justify; color: #3a4757; border-left: 3px solid ${m.laranja}; padding-left: 12px; margin: 4px 0 12px; }

/* 1 produto por página */
.prod-pg { padding-top: 10px; break-inside: avoid; }
.prod-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
.prod-num { flex: none; width: 30px; height: 30px; border-radius: 50%; background: ${m.laranja}; color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; }
.prod-nome { color: ${m.navy}; font-size: 16px; font-weight: 800; line-height: 1.3; }
.prod-uso { color: ${cinzaTexto}; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; margin-top: 2px; }
.prod-foto { text-align: center; margin: 8px 0 14px; }
.prod-foto img { max-width: 250px; max-height: 270px; object-fit: contain; }

/* Fechamento */
.fechamento { page-break-before: always; padding-top: 8px; }
.secao { color: ${m.navy}; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 14px 0 12px; }
.secao::after { content: ""; display: block; width: 46px; height: 1.5px; background: ${m.laranja}; margin-top: 6px; }
.fech-img { display: block; max-width: 100%; max-height: 320px; margin: 0 auto 8px; object-fit: contain; }
.fech-box { background: #f7f9fc; border: 1.5px dashed #d7dee8; border-radius: 16px; height: 150px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.fech-ph { color: #9aa7b8; font-size: 13px; font-weight: 700; }
.assinatura { display: flex; align-items: center; gap: 12px; margin-top: 22px; padding: 5mm 8mm; }
.ass-end { font-size: 10px; color: ${cinzaTexto}; margin-top: 3px; }
`;
}
