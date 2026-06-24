/**
 * Apuração NÃO-CUMULATIVA (débito − crédito) — ICMS, e também PIS/COFINS (Real) e IPI.
 *
 * O imposto a recolher não é só "alíquota × venda": abate o crédito do que foi pago nas
 * ENTRADAS (compras/insumos). a_recolher = débito(saídas) − crédito(entradas); se o
 * crédito supera o débito, vira SALDO CREDOR a transportar. Determinístico, com memória
 * de cálculo. §2: alíquotas vêm de quem chama (base datada), não do modelo.
 */
import { aliquotaVigente } from "./tributario";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export type ApuracaoNaoCumulativa = {
  imposto: string;
  baseSaidas: number;
  aliquotaSaida: number;
  debito: number;
  baseEntradas: number;
  aliquotaEntrada: number;
  credito: number;
  aRecolher: number; // débito − crédito, se positivo
  saldoCredor: number; // crédito − débito, se positivo (transporta p/ o próximo período)
  memoria: string;
};

export function apurarNaoCumulativo(params: {
  imposto: string;
  baseSaidas: number; // vendas/faturamento tributado
  aliquotaSaida: number; // %
  baseEntradas: number; // compras/insumos com crédito
  aliquotaEntrada?: number; // % (default = alíquota de saída)
}): ApuracaoNaoCumulativa {
  const { imposto, baseSaidas, aliquotaSaida, baseEntradas } = params;
  const aliquotaEntrada = params.aliquotaEntrada ?? aliquotaSaida;

  const debito = (baseSaidas * aliquotaSaida) / 100;
  const credito = (baseEntradas * aliquotaEntrada) / 100;
  const liquido = debito - credito;
  const aRecolher = Math.max(0, liquido);
  const saldoCredor = Math.max(0, -liquido);

  const memoria =
    `${imposto} (não-cumulativo): ` +
    `débito = ${brl(baseSaidas)} × ${pct(aliquotaSaida)} = ${brl(debito)}; ` +
    `crédito = ${brl(baseEntradas)} × ${pct(aliquotaEntrada)} = ${brl(credito)}; ` +
    (aRecolher > 0
      ? `a recolher = ${brl(debito)} − ${brl(credito)} = ${brl(aRecolher)}.`
      : `saldo credor = ${brl(credito)} − ${brl(debito)} = ${brl(saldoCredor)} (transporta).`);

  return { imposto, baseSaidas, aliquotaSaida, debito, baseEntradas, aliquotaEntrada, credito, aRecolher, saldoCredor, memoria };
}

// Atalho para ICMS usando a alíquota vigente da base datada (mesma p/ entrada e saída por
// padrão; informe aliquotaEntrada p/ operações interestaduais 7/12/4%).
export function apurarIcms(params: {
  vendas: number;
  compras: number;
  regime: string;
  ano: number;
  aliquotaEntrada?: number;
}): ApuracaoNaoCumulativa {
  const regra = aliquotaVigente(params.regime, "ICMS", params.ano);
  if (!regra) throw new Error(`Sem alíquota de ICMS vigente para ${params.regime} em ${params.ano}.`);
  return apurarNaoCumulativo({
    imposto: "ICMS",
    baseSaidas: params.vendas,
    aliquotaSaida: regra.aliquota,
    baseEntradas: params.compras,
    aliquotaEntrada: params.aliquotaEntrada,
  });
}
