/**
 * Apuração de ENCARGOS DE FOLHA (patronais) — determinística, sobre a base datada.
 *
 * Sobre o total da folha: CPP (INSS patronal 20%), RAT (1/2/3%×FAP), Terceiros (~5,8%)
 * e FGTS (8%). O INSS do empregado (7,5–14%) é RETIDO do salário, não é custo do
 * empregador — fica de fora do custo patronal (só informado). No Simples, parte da CPP
 * pode já estar no DAS (anexos III/IV) — sinalizado. §2: alíquotas da base, não do modelo.
 */
import { aliquotaVigente } from "./tributario";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const ENCARGOS = ["CPP", "RAT", "TERCEIROS", "FGTS"] as const;

export type LinhaFolha = {
  encargo: string;
  aliquota: number;
  valor: number;
  oficial: boolean;
  fonte: string;
  nota: string | null;
  memoria: string;
};

export type ApuracaoFolha = {
  folha: number;
  ano: number;
  regime: string | null;
  linhas: LinhaFolha[];
  totalEncargos: number;
  custoTotalFolha: number; // folha + encargos patronais
  memoria: string;
  aviso: string;
};

export function apurarFolha(params: { folha: number; ano: number; regime?: string | null }): ApuracaoFolha {
  const { folha, ano } = params;
  const regime = params.regime ?? null;
  const linhas: LinhaFolha[] = [];

  for (const encargo of ENCARGOS) {
    const regra = aliquotaVigente("folha", encargo, ano);
    if (!regra) continue;
    const valor = (folha * regra.aliquota) / 100;
    const notaSimples =
      regime === "simples" && (encargo === "CPP")
        ? "No Simples, a CPP costuma estar no DAS (anexos I–III); confira o enquadramento."
        : regra.nota;
    linhas.push({
      encargo,
      aliquota: regra.aliquota,
      valor,
      oficial: regra.fonte.oficial,
      fonte: regra.fonte.nome,
      nota: notaSimples,
      memoria: `${encargo}: ${brl(folha)} × ${pct(regra.aliquota)} = ${brl(valor)}${regra.fonte.oficial ? "" : " (exemplo, validar)"}`,
    });
  }

  const totalEncargos = linhas.reduce((a, l) => a + l.valor, 0);
  const custoTotalFolha = folha + totalEncargos;
  const memoria =
    `Folha ${brl(folha)} → encargos patronais: ${linhas.map((l) => `${l.encargo} ${brl(l.valor)}`).join(" + ")} ` +
    `= ${brl(totalEncargos)}. Custo total da folha = ${brl(custoTotalFolha)}.`;

  return {
    folha,
    ano,
    regime,
    linhas,
    totalEncargos,
    custoTotalFolha,
    memoria,
    aviso: "INSS do empregado (7,5–14%) é retido do salário, não entra no custo patronal. Confirme RAT (risco×FAP) e enquadramento com o contador.",
  };
}
