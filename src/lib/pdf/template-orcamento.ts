import type { PropostaScope } from "../contracts";
import { segmentosLegiveis } from "../segmento";
import { tamanhoLegivel } from "../embalagem";

// Tipo "orcamento" — saída ERP, FIEL ao modelo real (ref: GVA_ALIMENTOS_..._Orcamento_9572,
// docs/estrutura-modelos.md "Orçamento (ERP)"): topo data/nº · cabeçalho da empresa com logo
// ies · caixa do cliente com borda · tabela Qt./Produto/Detalhe/Valor unitário/Subtotal ·
// Total + Valor líquido à direita · forma de pagamento. Valores sem "R$" (como no exemplo).
// Quantidade vem do PropostaItem (ajustada na revisão) → subtotal = valor unit. × qt.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dec = (v: string | number) =>
  Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Nº do orçamento: o ERP usa sequência própria que não temos. Derivamos um número
// estável (4 dígitos) do id da proposta só para preencher o campo do documento.
function numeroDoc(id: string): string {
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(0, 6) || "0";
  return String((parseInt(hex, 16) % 9000) + 1000);
}

export function orcamentoHtml(scope: PropostaScope): string {
  const navy = "#16335c";
  const azul = "#1f5fae";
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");
  const c = scope.condicoesComerciais;

  let total = 0;
  const linhas = scope.itens
    .map((it) => {
      const e = it.embalagens[0];
      const unit = e ? Number(e.preco) : 0;
      const sub = unit * it.quantidade;
      total += sub;
      const emb = e ? ` <span class="emb">· emb. ${esc(tamanhoLegivel(e.tamanho, e.unidade))}</span>` : "";
      return `<tr>
        <td class="qt">${it.quantidade}</td>
        <td class="prod"><span class="cod">${esc(it.codigo)}</span> - <strong>${esc(it.nome)}</strong></td>
        <td class="det">${esc(it.descricaoUso)}${emb}</td>
        <td class="num">${dec(unit)}</td>
        <td class="num">${dec(sub)}</td>
      </tr>`;
    })
    .join("");

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #25303f; font-size: 11px; padding: 0 12mm; }

/* topo: data (esq) / nº do orçamento (dir) */
.topbar { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0 8px; color: #6b7787; font-size: 11px; }
.topbar .docno { color: #25303f; font-size: 14px; }
.topbar .docno b { color: ${navy}; font-weight: 800; }

/* cabeçalho da empresa */
.empresa { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; border-bottom: 2px solid #e6ecf4; padding-bottom: 12px; }
.empresa .left { display: flex; gap: 12px; align-items: flex-start; }
.logo { width: 54px; height: 54px; flex: none; border-radius: 8px; background: linear-gradient(135deg, ${azul}, ${navy});
  display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 17px; letter-spacing: -.5px; }
.emp-nome { font-size: 16px; font-weight: 800; color: ${navy}; }
.emp-info > div { margin-top: 2px; }
.emp-end { font-size: 9px; color: #6b7787; line-height: 1.5; max-width: 320px; }
.emp-razao { font-size: 9px; color: #8a98ab; text-transform: uppercase; }
.emp-doc { font-size: 9px; color: #8a98ab; }
.empresa .right { text-align: right; white-space: nowrap; }
.emp-fone { font-size: 14px; font-weight: 800; color: ${navy}; }
.emp-mail { font-size: 9.5px; color: #6b7787; margin-top: 4px; }

/* caixa do cliente */
.cli-box { display: flex; gap: 16px; border: 1px solid #d8e0ea; border-radius: 6px; padding: 12px 14px; margin: 14px 0 6px; }
.cli-left { flex: 1; }
.cli-nome { font-size: 13px; font-weight: 800; color: ${navy}; }
.cli-doc, .cli-seg { font-size: 10px; color: #6b7787; margin-top: 3px; }
.cli-seg { text-transform: capitalize; }
.cli-right { width: 210px; flex: none; border-left: 1px solid #e6ecf4; padding-left: 16px; }
.fld { margin-bottom: 8px; }
.fld:last-child { margin-bottom: 0; }
.fl { font-size: 10px; font-weight: 700; color: ${navy}; }
.fv { font-size: 10.5px; color: #4a5868; margin-top: 1px; }

.comodato { font-size: 10px; color: #6b7787; margin: 8px 0 12px; }

/* tabela */
table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
thead { display: table-header-group; }
th { background: #f1f4f8; color: #5a6878; text-align: left; padding: 8px 9px; font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #d8e0ea; }
th.num, td.num { text-align: right; white-space: nowrap; }
th.qt, td.qt { text-align: center; width: 34px; }
td { padding: 8px 9px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
tr { break-inside: avoid; }
td.prod { width: 38%; }
td.prod .cod { color: #9aa7b8; }
td.prod strong { color: #25303f; }
td.det { color: #6b7787; font-size: 9.5px; line-height: 1.45; }
td.det .emb { color: #9aa7b8; }

/* totais */
.totais { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.trow { display: flex; justify-content: space-between; width: 230px; padding: 6px 0; border-top: 1px solid #eef2f7; }
.trow .tl { color: #6b7787; }
.trow .tv { font-weight: 800; color: ${navy}; }
.trow.liq { border-top: 2px solid #d8e0ea; }
.trow.liq .tl { color: ${navy}; font-weight: 700; }
.trow.liq .tv { font-size: 13px; }

/* pagamento */
.pgto { margin-top: 18px; border-top: 1px solid #e6ecf4; padding-top: 10px; font-size: 10.5px; }
.pgto .pl { font-weight: 700; color: ${navy}; }
.pgto .pv { color: #4a5868; margin-top: 2px; }
</style></head><body>
  <div class="topbar">
    <span class="date">${data}</span>
    <span class="docno">Orçamento <b>${numeroDoc(scope.id)}</b></span>
  </div>

  <div class="empresa">
    <div class="left">
      <div class="logo">ies</div>
      <div class="emp-info">
        <div class="emp-nome">INDEBA EXPRESS</div>
        <div class="emp-end">Rua Cosme de Farias, 05 - Galpão 01 - Boca do Rio - Salvador - BA - CEP: 41710-010</div>
        <div class="emp-razao">IES Equipamentos, Soluções e Produtos de Limpeza Ltda</div>
        <div class="emp-doc">CNPJ: 13.313.568/0001-04 &nbsp; IE: 150336336</div>
      </div>
    </div>
    <div class="right">
      <div class="emp-fone">(71) 3369-2306</div>
      <div class="emp-mail">gerencia@indebaexpress.com.br</div>
    </div>
  </div>

  <div class="cli-box">
    <div class="cli-left">
      <div class="cli-nome">${esc(scope.cliente.razaoSocial)}</div>
      ${scope.cliente.cnpj ? `<div class="cli-doc">CNPJ: ${esc(scope.cliente.cnpj)}</div>` : ""}
      ${scope.cliente.segmento ? `<div class="cli-seg">${esc(segmentosLegiveis(scope.cliente.segmento))}</div>` : ""}
    </div>
    <div class="cli-right">
      <div class="fld"><div class="fl">Validade da proposta</div><div class="fv">${esc(c.validade)}</div></div>
      <div class="fld"><div class="fl">Previsão de entrega</div><div class="fv">${esc(c.prazoEntrega)}</div></div>
    </div>
  </div>

  <div class="comodato">Contrato de comodato 12 meses</div>

  <table>
    <thead><tr>
      <th class="qt">Qt.</th>
      <th>Produto/Serviço</th>
      <th>Detalhe do item</th>
      <th class="num">Valor unitário</th>
      <th class="num">Subtotal</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <div class="totais">
    <div class="trow"><span class="tl">Total</span><span class="tv">${dec(total)}</span></div>
    <div class="trow liq"><span class="tl">Valor líquido</span><span class="tv">${dec(total)}</span></div>
  </div>

  <div class="pgto">
    <div class="pl">Forma de pagamento:</div>
    <div class="pv">${esc(c.pagamento)}${c.frete ? ` &nbsp;·&nbsp; Frete: ${esc(c.frete)}` : ""}</div>
  </div>
</body></html>`;
}
