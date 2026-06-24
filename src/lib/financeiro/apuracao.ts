/**
 * Apuração de imposto — DETERMINÍSTICA, ciente da atividade e da VIGÊNCIA do ano.
 *
 * O agente fiscal apura sobre o faturamento usando a base tributária datada
 * (tributario.ts): para cada imposto aplicável ao regime/atividade no ano, calcula
 * base × alíquota, carimba vigência + fonte (oficial vs exemplo) e o aviso legal. §2:
 * a alíquota vem SEMPRE da base, nunca do modelo. Não soma ICMS e ISS juntos — escolhe
 * pelo tipo de atividade (erro clássico de apuração ingênua).
 */
import { aliquotaVigente, impostosDoRegime, AVISO_LEGAL } from "./tributario";

export type Atividade = "comercio" | "servico" | "industria";
export type Regime = "simples" | "presumido" | "real" | "ibs_cbs";

// Quais impostos "de operação" (base ≈ faturamento) cabem a cada atividade.
const OPERACAO_POR_ATIVIDADE: Record<Atividade, string[]> = {
  comercio: ["ICMS"],
  servico: ["ISS"],
  industria: ["ICMS", "IPI"],
};
const FEDERAIS_FATURAMENTO = ["PIS", "COFINS", "CBS", "IBS"]; // base = faturamento
const SOBRE_LUCRO = ["IRPJ", "CSLL"]; // base real = lucro (presumido/real), não faturamento

export type LinhaApuracao = {
  imposto: string;
  base: number; // base de cálculo usada
  aliquota: number; // %
  valor: number; // base × alíquota / 100
  vigencia: string; // vigência da regra aplicada
  fonte: string; // nome da fonte
  oficial: boolean; // false = exemplo a validar
  nota: string | null;
};

export type Apuracao = {
  regime: Regime;
  atividade: Atividade;
  ano: number;
  faturamento: number;
  linhas: LinhaApuracao[];
  totalSobreFaturamento: number; // soma dos impostos de operação + federais (base faturamento)
  cargaEfetiva: number; // totalSobreFaturamento / faturamento * 100
  aviso: string;
};

// Impostos aplicáveis a um regime+atividade (ignora o que não casa com a atividade).
function impostosAplicaveis(regime: Regime, atividade: Atividade, ano: number): string[] {
  const vigentes = impostosDoRegime(regime, ano).map((r) => r.imposto);
  const operacao = OPERACAO_POR_ATIVIDADE[atividade];
  return vigentes.filter(
    (imp) =>
      operacao.includes(imp) || FEDERAIS_FATURAMENTO.includes(imp) || SOBRE_LUCRO.includes(imp) || imp === "DAS",
  );
}

export function apurar(params: {
  regime: Regime;
  atividade: Atividade;
  ano: number;
  faturamento: number;
}): Apuracao {
  const { regime, atividade, ano, faturamento } = params;
  const linhas: LinhaApuracao[] = [];

  for (const imposto of impostosAplicaveis(regime, atividade, ano)) {
    const regra = aliquotaVigente(regime, imposto, ano);
    if (!regra) continue;
    // Base: faturamento para operação/federais/DAS; lucro (aqui ilustrado como faturamento) p/ IRPJ/CSLL.
    const sobreLucro = SOBRE_LUCRO.includes(imposto);
    const base = faturamento;
    const valor = (base * regra.aliquota) / 100;
    linhas.push({
      imposto,
      base,
      aliquota: regra.aliquota,
      valor,
      vigencia: regra.vigenciaFim ? `${regra.vigenciaInicio}…${regra.vigenciaFim}` : `${regra.vigenciaInicio}…`,
      fonte: regra.fonte.nome,
      oficial: regra.fonte.oficial,
      nota: sobreLucro
        ? "Base ilustrada = faturamento; a base REAL é o lucro (presumido/real). Confirme com o contador."
        : regra.nota,
    });
  }

  // Carga "sobre faturamento" não soma IRPJ/CSLL (base diferente) — evita inflar a comparação.
  const sobreFaturamento = linhas.filter((l) => !SOBRE_LUCRO.includes(l.imposto));
  const total = sobreFaturamento.reduce((a, l) => a + l.valor, 0);

  return {
    regime,
    atividade,
    ano,
    faturamento,
    linhas,
    totalSobreFaturamento: total,
    cargaEfetiva: faturamento ? (total / faturamento) * 100 : 0,
    aviso: AVISO_LEGAL,
  };
}

export type ComparacaoRegime = { regime: Regime; total: number; cargaEfetiva: number };

// Compara a carga (sobre faturamento) entre regimes no ano — a base da sugestão "pagar
// menos imposto", 100% determinística. Ordena do menor para o maior.
export function compararRegimes(params: {
  atividade: Atividade;
  ano: number;
  faturamento: number;
  regimes?: Regime[];
}): { ranking: ComparacaoRegime[]; aviso: string } {
  const regimes = params.regimes ?? (["simples", "presumido", "real"] as Regime[]);
  const ranking = regimes
    .map((regime) => {
      const ap = apurar({ regime, atividade: params.atividade, ano: params.ano, faturamento: params.faturamento });
      return { regime, total: ap.totalSobreFaturamento, cargaEfetiva: ap.cargaEfetiva };
    })
    .sort((a, b) => a.total - b.total);
  return { ranking, aviso: AVISO_LEGAL };
}
