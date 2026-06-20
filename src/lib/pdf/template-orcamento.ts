import type { PropostaScope } from "../contracts";

// Tipo "orcamento" — saída enxuta estilo ERP (ref: GVA_..._Orcamento_9572):
// cabeçalho da empresa, dados do cliente e tabela produto/valor/subtotal + total.
// Sem quantidade no modelo ainda → qt. = 1 por embalagem (preço = subtotal).
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (v: string) =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function orcamentoHtml(scope: PropostaScope): string {
  const navy = "#16335c";
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");

  let total = 0;
  const linhas = scope.itens
    .map((it) => {
      const e = it.embalagens[0];
      const sub = e ? Number(e.preco) : 0;
      total += sub;
      return `<tr>
        <td class="qt">1</td>
        <td><strong>${esc(it.nome)}</strong><br/><span class="det">${esc(it.descricaoUso)}</span></td>
        <td class="emb">${e ? `${e.tamanho} ${e.unidade}` : "—"}</td>
        <td class="num">${e ? brl(e.preco) : "—"}</td>
        <td class="num">${brl(String(sub.toFixed(2)))}</td>
      </tr>`;
    })
    .join("");

  const c = scope.condicoesComerciais;
  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #25303f; font-size: 11px; padding: 0 12mm; }
.topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${navy}; padding: 4px 0 10px; }
.empresa { font-size: 19px; font-weight: 800; color: ${navy}; letter-spacing: .5px; }
.empresa small { display: block; font-size: 8.5px; font-weight: 400; color: #6b7787; line-height: 1.5; margin-top: 3px; }
.doc { text-align: right; }
.doc .t { font-size: 16px; font-weight: 800; color: ${navy}; }
.doc .d { font-size: 9px; color: #6b7787; }
.cliente { margin: 12px 0; font-size: 11px; }
.cliente b { color: ${navy}; }
table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
th { background: ${navy}; color: #fff; text-align: left; padding: 7px 9px; font-size: 9px; text-transform: uppercase; letter-spacing: .4px; }
td { padding: 7px 9px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
td.qt { text-align: center; width: 34px; }
td.num { text-align: right; white-space: nowrap; }
td.emb { white-space: nowrap; color: #4a5868; }
.det { color: #7a8696; font-size: 9px; }
tr:nth-child(even) td { background: #f8fafd; }
.total { display: flex; justify-content: flex-end; margin-top: 10px; }
.total .box { background: ${navy}; color: #fff; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 800; }
.cond { margin-top: 18px; font-size: 9.5px; color: #5a6878; line-height: 1.7; border-top: 1px solid #e6ecf4; padding-top: 8px; }
.cond b { color: ${navy}; }
</style></head><body>
  <div class="topo">
    <div class="empresa">INDEBA EXPRESS
      <small>IES Equipamentos, Soluções e Produtos de Limpeza Ltda<br/>
      Rua Cosme de Farias, 05 — Galpão 01, Boca do Rio, Salvador — BA · CEP 41710-010<br/>
      (71) 3369-2306 · gerencia@indebaexpress.com.br</small>
    </div>
    <div class="doc"><div class="t">Orçamento</div><div class="d">${data}</div></div>
  </div>

  <div class="cliente"><b>Cliente:</b> ${esc(scope.cliente.razaoSocial)}${
    scope.cliente.segmento ? ` · ${esc(scope.cliente.segmento.replace(/_/g, " "))}` : ""
  }</div>

  <table>
    <thead><tr><th>Qt.</th><th>Produto / Serviço</th><th>Embalagem</th><th>Valor unitário</th><th>Subtotal</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <div class="total"><div class="box">Total &nbsp; ${brl(String(total.toFixed(2)))}</div></div>

  <div class="cond">
    <b>Validade:</b> ${esc(c.validade)} &nbsp;·&nbsp; <b>Prazo de entrega:</b> ${esc(c.prazoEntrega)} &nbsp;·&nbsp;
    <b>Pagamento:</b> ${esc(c.pagamento)} &nbsp;·&nbsp; <b>Frete:</b> ${esc(c.frete)}
  </div>
</body></html>`;
}
