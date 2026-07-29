import type { PropostaScope, PropostaItem } from "../contracts";
import { tamanhoLegivel } from "../embalagem";
import { chaveImagem } from "../imagem-produto";

// Tipo "comercial" — formato Indeba fabricante (ref: Proposta Dengo). Estrutura
// FIEL ao modelo (docs/estrutura-modelos.md), sem inventar: capa + páginas
// institucionais REAIS (imagens do PDF original) + "Soluções Indicadas para o
// [Cliente]" (produtos dinâmicos, formato fabricante) + condições + observações.
type Assets = { logo: string; institucional: string; experienciaSegura: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (v: string) =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function produto(item: PropostaItem, dataUri: string): string {
  const unid = item.embalagens[0]?.unidade === "kg" ? "kg" : "litro";
  const emb = item.embalagens.map((e) => `<div class="v">${esc(tamanhoLegivel(e.tamanho, e.unidade))}</div>`).join("");
  const prc = item.embalagens.map((e) => `<div class="v">${brl(e.preco)}</div>`).join("");
  const cst = item.embalagens
    .map((e) => `<div class="v">${e.custoDiluido ? brl(e.custoDiluido) : "—"}${e.diluicaoMax ? ` <span class="dil">até ${esc(e.diluicaoMax)}</span>` : ""}</div>`)
    .join("");
  return `<div class="prod">
    <div class="foto"><img src="${dataUri}" alt="${esc(item.nome)}"/></div>
    <div class="info">
      <div class="nome">${esc(item.nome)}</div>
      ${item.descricaoUso ? `<p class="desc">${esc(item.descricaoUso)}</p>` : ""}
      <div class="boxes">
        <div class="bx"><div class="bh">Embalagem</div>${emb}</div>
        <div class="bx"><div class="bh">Preço</div>${prc}</div>
        <div class="bx"><div class="bh">Custo final por ${unid} diluído</div>${cst}</div>
      </div>
    </div>
  </div>`;
}

export function comercialHtml(scope: PropostaScope, imagens: Record<string, string>, a: Assets): string {
  const navy = "#0b4f8a";
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const itens = scope.itens.map((it) => produto(it, imagens[chaveImagem(it)] ?? "")).join("");
  const c = scope.condicoesComerciais;

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #25303f; font-size: 11.5px; }
.pg { padding: 10px 12mm 0; }
.break { page-break-after: always; }
/* Capa */
.capa { height: 252mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
.capa img { width: 188px; margin-bottom: 64px; }
.capa h1 { color: ${navy}; font-size: 30px; font-weight: 800; }
.capa .cli { margin-top: 72px; color: ${navy}; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
.capa .dt { color: #6b7787; font-size: 11px; text-transform: uppercase; margin-top: 4px; }
/* Páginas institucionais reais (imagens do modelo), enquadradas em 1 página cada */
.inst-pg { height: 270mm; display: flex; align-items: center; justify-content: center; page-break-after: always; }
.inst-pg img { max-width: 100%; max-height: 100%; }
/* Soluções */
.secao { color: ${navy}; font-size: 15px; font-weight: 800; border-bottom: 2px solid #e6ecf4; padding-bottom: 6px; margin: 6px 0 14px; }
.prod { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 18px; break-inside: avoid; }
.foto { flex: 0 0 120px; height: 130px; display: flex; align-items: center; justify-content: center; }
.foto img { max-width: 116px; max-height: 128px; object-fit: contain; }
.info { flex: 1; }
.nome { color: ${navy}; font-size: 13.5px; font-weight: 800; }
.desc { color: #5a6878; line-height: 1.45; margin: 5px 0 10px; font-size: 10.5px; }
.boxes { display: flex; gap: 10px; }
.bx { flex: 1; background: #eef4fb; border: 1px solid #d8e6f3; border-radius: 8px; padding: 8px 10px; text-align: center; }
.bh { color: ${navy}; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 5px; }
.bx .v { font-size: 12px; font-weight: 700; color: #1f3a52; padding: 2px 0; }
.bx .v .dil { font-size: 8px; font-weight: 400; color: #7a8696; }
/* Condições */
.cond-sec { margin-top: 10px; }
table.cond { width: 100%; border-collapse: collapse; font-size: 11px; }
table.cond td { border: 1px solid #d8e6f3; padding: 7px 10px; }
table.cond td.l { background: #eef4fb; color: ${navy}; font-weight: 700; width: 40%; }
.obs { margin-top: 14px; font-size: 10px; color: #5a6878; line-height: 1.6; }
.obs b { color: ${navy}; }
/* As 5 Etapas Essenciais de Higienização */
.etapas-pg { page-break-before: always; padding-top: 6px; }
.etapa { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px; break-inside: avoid; }
.etapa .num { flex: 0 0 32px; height: 32px; border-radius: 50%; background: ${navy}; color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; }
.etapa .et-info { flex: 1; padding-top: 2px; }
.etapa .et-tit { color: ${navy}; font-weight: 800; font-size: 13px; }
.etapa .et-desc { color: #5a6878; font-size: 11px; line-height: 1.5; margin-top: 2px; }
.etapas-nota { background: #eef4fb; border: 1px solid #d8e6f3; border-radius: 8px; padding: 10px 14px; font-size: 10.5px; color: #3a4757; line-height: 1.6; margin-top: 8px; }
.etapas-nota b { color: ${navy}; }
</style></head><body>
  <section class="capa">
    <img src="${a.logo}" alt="Indeba"/>
    <h1>Proposta Comercial</h1>
    <div class="cli">${esc(scope.cliente.razaoSocial)}</div>
    <div class="dt">${data}</div>
  </section>

  ${a.institucional ? `<div class="inst-pg"><img src="${a.institucional}" alt="Institucional"/></div>` : ""}
  ${a.experienciaSegura ? `<div class="inst-pg"><img src="${a.experienciaSegura}" alt="Programa Experiência Segura"/></div>` : ""}

  <div class="pg etapas-pg">
    <h2 class="secao">As 5 Etapas Essenciais de Higienização</h2>
    <div class="etapa"><div class="num">1</div><div class="et-info"><div class="et-tit">Pré-lavagem</div><div class="et-desc">Remoção dos resíduos grosseiros com água, preparando a superfície para a limpeza.</div></div></div>
    <div class="etapa"><div class="num">2</div><div class="et-info"><div class="et-tit">Limpeza</div><div class="et-desc">Aplicação do detergente/desengordurante adequado para remover a sujidade aderida.</div></div></div>
    <div class="etapa"><div class="num">3</div><div class="et-info"><div class="et-tit">Enxágue</div><div class="et-desc">Remoção do produto e da sujidade suspensa, evitando resíduos químicos nas superfícies.</div></div></div>
    <div class="etapa"><div class="num">4</div><div class="et-info"><div class="et-tit">Desinfecção</div><div class="et-desc">Aplicação de sanitizante para eliminação dos micro-organismos remanescentes.</div></div></div>
    <div class="etapa"><div class="num">5</div><div class="et-info"><div class="et-tit">Materiais de Comunicação</div><div class="et-desc">Cartazes, sinalização e procedimentos operacionais que padronizam e chancelam a higienização.</div></div></div>
    <div class="etapas-nota"><b>Assistência Técnica:</b> visitas periódicas com efeito corretivo e preventivo, em escala de atendimento mensal ou semanal, garantindo a correta execução de todas as etapas.</div>
  </div>

  <div class="pg">
    <h2 class="secao">Soluções Indicadas para o ${esc(scope.cliente.razaoSocial)}</h2>
    ${itens}

    <div class="cond-sec">
      <h2 class="secao">Condições Comerciais</h2>
      <table class="cond">
        <tr><td class="l">Validade desta proposta</td><td>${esc(c.validade)}</td></tr>
        <tr><td class="l">Prazo de entrega</td><td>${esc(c.prazoEntrega)}</td></tr>
        <tr><td class="l">Condições de pagamento</td><td>${esc(c.pagamento)}</td></tr>
        <tr><td class="l">Frete</td><td>${esc(c.frete)}</td></tr>
        <tr><td class="l">Pedido mínimo (frete CIF)</td><td>Sob consulta</td></tr>
      </table>
      <p class="obs">
        <b>Observações:</b><br/>
        — Assistência técnica e manutenção dos equipamentos Indeba são permanentes;<br/>
        — Produtos ofertados são de fabricação da Indeba Indústria e Comércio Ltda, origem nacional e marca Indeba.
      </p>
    </div>
  </div>
</body></html>`;
}
