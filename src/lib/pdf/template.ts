import type { PropostaScope, PropostaItem } from "../contracts";

// Paleta da marca (extraída do header real ies / indeba express).
const MARCAS = {
  indeba_express: { nome: "INDEBA EXPRESS", navy: "#16335c", azul: "#1f5fae", laranja: "#ef7d1a", titulo: "Proposta de Implantação" },
  indeba: { nome: "INDEBA", navy: "#0b3d24", azul: "#0b6b3a", laranja: "#7cb342", titulo: "Proposta Comercial" },
} as const;

// Escapa para uso seguro em texto E em atributos (inclui aspas) — evita quebra
// de atributo e injeção de tag no HTML renderizado pelo Chromium (campos do
// PropostaScope chegam do cliente em /api/pdf).
export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const brl = (v: string) =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function card(item: PropostaItem, idx: number, dataUri: string): string {
  const linhas = item.embalagens
    .map(
      (e) => `<tr>
        <td>${e.tamanho} ${e.unidade}</td>
        <td class="valor">${brl(e.preco)}</td>
        <td>${e.diluicaoMax ? esc(e.diluicaoMax) : "—"}</td>
        <td class="custo">${e.custoDiluido ? `<span class="eco">${brl(e.custoDiluido)}</span>` : "—"}</td>
      </tr>`,
    )
    .join("");
  return `<article class="produto">
    <div class="foto"><img src="${dataUri}" alt="${esc(item.nome)}"/></div>
    <div class="info">
      <div class="nome"><span class="num">${idx + 1}</span>${esc(item.nome)}<span class="cod">${esc(item.codigo)}</span></div>
      ${item.descricaoUso ? `<p class="desc">${esc(item.descricaoUso)}</p>` : ""}
      <table class="spec">
        <thead><tr><th>Embalagem</th><th>Valor</th><th>Diluição máx.</th><th>Custo / litro diluído</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  </article>`;
}

// PropostaScope → HTML premium (view do objeto canônico).
export function documentoHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  banner: string,
): string {
  const m = MARCAS[scope.template];
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");
  const cabecalho = banner
    ? `<img class="banner" src="${banner}" alt="${m.nome}"/>`
    : `<div class="banner-txt">${m.nome}</div>`;

  const itens = scope.itens.map((it, i) => card(it, i, imagens[it.codigo] ?? "")).join("");

  const cond = scope.condicoesComerciais;
  const condItem = (l: string, v: string) =>
    `<div class="cond"><span class="cl">${l}</span><span class="cv">${esc(v)}</span></div>`;

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>${css(m)}</style></head><body>
    ${cabecalho}
    <div class="pg">
    <div class="titulo">
      <h1>${m.titulo}</h1>
      <div class="accent"></div>
    </div>

    <section class="cliente">
      <div><span class="lbl">Cliente</span><span class="val">${esc(scope.cliente.razaoSocial)}</span></div>
      ${scope.cliente.segmento ? `<div><span class="lbl">Segmento</span><span class="val">${esc(scope.cliente.segmento.replace(/_/g, " "))}</span></div>` : ""}
      <div><span class="lbl">Emitida em</span><span class="val">${data}</span></div>
    </section>

    <p class="apresentacao">${esc(scope.textoApresentacao.conteudo)}</p>

    <h2 class="secao">Soluções propostas</h2>
    <section class="itens">${itens}</section>

    <h2 class="secao">Condições comerciais</h2>
    <section class="condicoes">
      ${condItem("Validade", cond.validade)}
      ${condItem("Prazo de entrega", cond.prazoEntrega)}
      ${condItem("Pagamento", cond.pagamento)}
      ${condItem("Frete", cond.frete)}
    </section>

    <p class="assinatura">Atenciosamente,<br/><strong>Matheus Resende</strong> · (71) 99196-2650</p>
    </div>
  </body></html>`;
}

function css(m: (typeof MARCAS)[keyof typeof MARCAS]): string {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #25303f; font-size: 11.5px; -webkit-font-smoothing: antialiased; }
/* margens L/R da página são 0 → banner ocupa toda a largura, sem recorte vertical */
.banner { display: block; width: 100%; }
.banner-txt { background: ${m.navy}; color: #fff; font-size: 24px; font-weight: 800; letter-spacing: 1px; padding: 18px 12mm; }
.pg { padding: 16px 12mm 0; }

.titulo { margin: 14px 0 14px; }
.titulo h1 { color: ${m.navy}; font-size: 22px; font-weight: 800; letter-spacing: .2px; }
.accent { width: 54px; height: 4px; background: ${m.laranja}; border-radius: 2px; margin-top: 6px; }

.cliente { display: flex; flex-wrap: wrap; gap: 0 28px; background: #f5f8fc; border-left: 4px solid ${m.laranja};
  border-radius: 0 6px 6px 0; padding: 11px 16px; margin-bottom: 14px; }
.cliente .lbl { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: .6px; color: #8a98ab; }
.cliente .val { font-size: 12.5px; font-weight: 700; color: ${m.navy}; }

.apresentacao { line-height: 1.6; text-align: justify; color: #3a4757; margin-bottom: 22px; }

.secao { color: ${m.navy}; font-size: 13px; text-transform: uppercase; letter-spacing: .8px;
  padding-bottom: 5px; border-bottom: 2px solid #e6ecf4; margin: 6px 0 12px; }

.produto { display: flex; gap: 16px; align-items: flex-start; border: 1px solid #e6ecf4;
  border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; background: #fff; break-inside: avoid; }
.foto { flex: 0 0 116px; height: 130px; display: flex; align-items: center; justify-content: center;
  background: #fbfcfe; border: 1px solid #eef2f7; border-radius: 8px; }
.foto img { max-width: 104px; max-height: 122px; object-fit: contain; }
.info { flex: 1; }
.nome { color: ${m.navy}; font-size: 14.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.nome .num { background: ${m.azul}; color: #fff; font-size: 11px; width: 20px; height: 20px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; }
.nome .cod { font-size: 8.5px; font-weight: 600; color: #9aa7b8; background: #f1f5fa; padding: 2px 7px; border-radius: 10px; letter-spacing: .4px; }
.desc { color: #5a6878; line-height: 1.45; margin: 6px 0 9px; }

table.spec { width: 100%; border-collapse: collapse; font-size: 10.5px; border-radius: 6px; overflow: hidden; }
table.spec th { background: ${m.navy}; color: #fff; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: .4px; }
table.spec td { padding: 6px 10px; border-bottom: 1px solid #eef2f7; }
table.spec tbody tr:nth-child(even) { background: #f8fafd; }
table.spec td.valor { font-weight: 800; color: ${m.azul}; font-size: 12px; }
table.spec td.custo .eco { display: inline-block; background: #e8f6ec; color: #1f8a4c; font-weight: 700; padding: 1px 8px; border-radius: 10px; }

.condicoes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
.cond { background: #f5f8fc; border: 1px solid #e6ecf4; border-radius: 8px; padding: 9px 13px; }
.cond .cl { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: .6px; color: #8a98ab; }
.cond .cv { font-size: 12px; font-weight: 700; color: ${m.navy}; }

.assinatura { color: #4a5868; line-height: 1.5; font-size: 11px; margin-top: 6px; }
.assinatura strong { color: ${m.navy}; }
`;
}
