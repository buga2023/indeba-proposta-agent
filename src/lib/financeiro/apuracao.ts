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
import { calcularDAS, FONTE_SIMPLES, type Anexo } from "./simples";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

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

// Anexo do Simples por atividade (LC 123). Serviços: assume Anexo III; o Fator R
// (folha÷RBT12) pode reenquadrar no V — sem dado de folha aqui, sinaliza-se na nota.
const ANEXO_POR_ATIVIDADE: Record<Atividade, Anexo> = { comercio: "I", industria: "II", servico: "III" };

export type LinhaApuracao = {
  imposto: string;
  base: number; // base de cálculo usada
  aliquota: number; // %
  valor: number; // base × alíquota / 100
  vigencia: string; // vigência da regra aplicada
  fonte: string; // nome da fonte
  oficial: boolean; // false = exemplo a validar
  nota: string | null;
  memoria: string; // o "por quê": base × alíquota = valor, com vigência + fonte
};

export type Apuracao = {
  regime: Regime;
  atividade: Atividade;
  ano: number;
  faturamento: number;
  linhas: LinhaApuracao[];
  totalSobreFaturamento: number; // soma dos impostos de operação + federais (base faturamento)
  cargaEfetiva: number; // totalSobreFaturamento / faturamento * 100
  memoria: string; // explicação consolidada (o porquê do total)
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

// Simples Nacional: tributo unificado (só DAS), pelo motor de anexos OFICIAL (simples.ts),
// tratando o faturamento informado como RBT12 e receita do período. §2: a tabela é
// estatutária (LC 123/2006), não número do modelo. RBT12 e Fator R reais → confirmar com o
// contador. Acima do teto (R$ 4,8M) o Simples não é aplicável — sinaliza, não inventa valor.
function apurarSimples(atividade: Atividade, ano: number, faturamento: number): Apuracao {
  const anexo = ANEXO_POR_ATIVIDADE[atividade];
  const base = {
    regime: "simples" as const,
    atividade,
    ano,
    faturamento,
    aviso: AVISO_LEGAL,
  };
  try {
    const r = calcularDAS(faturamento, faturamento, anexo);
    const caveat =
      atividade === "servico"
        ? `Anexo ${anexo} assumido; o Fator R (folha÷RBT12) pode enquadrar no Anexo V. `
        : "";
    const linha: LinhaApuracao = {
      imposto: "DAS",
      base: faturamento,
      aliquota: r.aliquotaEfetiva,
      valor: r.das,
      vigencia: "desde 2018 (LC 155/2016)",
      fonte: FONTE_SIMPLES,
      oficial: true,
      nota: `${caveat}RBT12 e receita do mês tratados como o faturamento informado — confirme com o contador.`,
      memoria: r.memoria,
    };
    return {
      ...base,
      linhas: [linha],
      totalSobreFaturamento: r.das,
      cargaEfetiva: r.aliquotaEfetiva,
      memoria: `Apuração simples/${atividade}, ano ${ano}, faturamento ${brl(faturamento)}. ${r.memoria}`,
    };
  } catch (e) {
    return {
      ...base,
      linhas: [],
      totalSobreFaturamento: 0,
      cargaEfetiva: 0,
      memoria: `Simples não aplicável: ${(e as Error).message}`,
    };
  }
}

export function apurar(params: {
  regime: Regime;
  atividade: Atividade;
  ano: number;
  faturamento: number;
}): Apuracao {
  const { regime, atividade, ano, faturamento } = params;
  if (regime === "simples") return apurarSimples(atividade, ano, faturamento);
  const linhas: LinhaApuracao[] = [];

  for (const imposto of impostosAplicaveis(regime, atividade, ano)) {
    const regra = aliquotaVigente(regime, imposto, ano);
    if (!regra) continue;
    // Base: faturamento para operação/federais/DAS; lucro (aqui ilustrado como faturamento) p/ IRPJ/CSLL.
    const sobreLucro = SOBRE_LUCRO.includes(imposto);
    const base = faturamento;
    const valor = (base * regra.aliquota) / 100;
    const vigencia = regra.vigenciaFim ? `${regra.vigenciaInicio}…${regra.vigenciaFim}` : `${regra.vigenciaInicio}…`;
    linhas.push({
      imposto,
      base,
      aliquota: regra.aliquota,
      valor,
      vigencia,
      fonte: regra.fonte.nome,
      oficial: regra.fonte.oficial,
      nota: sobreLucro
        ? "Base ilustrada = faturamento; a base REAL é o lucro (presumido/real). Confirme com o contador."
        : regra.nota,
      memoria:
        `${imposto} (${regime}): ${brl(base)} × ${pct(regra.aliquota)} = ${brl(valor)} ` +
        `· vigência ${vigencia} · fonte: ${regra.fonte.nome}${regra.fonte.oficial ? "" : " (exemplo, validar)"}` +
        `${sobreLucro ? " · base ilustrada = faturamento (real é o lucro)" : ""}`,
    });
  }

  // Carga "sobre faturamento" não soma IRPJ/CSLL (base diferente) — evita inflar a comparação.
  const sobreFaturamento = linhas.filter((l) => !SOBRE_LUCRO.includes(l.imposto));
  const total = sobreFaturamento.reduce((a, l) => a + l.valor, 0);

  const carga = faturamento ? (total / faturamento) * 100 : 0;
  const memoria =
    `Apuração ${regime}/${atividade}, ano ${ano}, faturamento ${brl(faturamento)}. ` +
    `Impostos sobre faturamento: ${sobreFaturamento.map((l) => `${l.imposto} ${brl(l.valor)}`).join(" + ") || "nenhum"} ` +
    `= ${brl(total)} (carga ${pct(carga)}).`;

  return {
    regime,
    atividade,
    ano,
    faturamento,
    linhas,
    totalSobreFaturamento: total,
    cargaEfetiva: carga,
    memoria,
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
      return { regime, total: ap.totalSobreFaturamento, cargaEfetiva: ap.cargaEfetiva, aplicavel: ap.linhas.length > 0 };
    })
    // Regime sem linhas = não aplicável (ex.: Simples acima do teto) — fora do ranking,
    // senão entraria como "R$ 0" e apareceria falsamente como o mais barato.
    .filter((r) => r.aplicavel)
    .map(({ aplicavel: _aplicavel, ...r }) => r)
    .sort((a, b) => a.total - b.total);
  return { ranking, aviso: AVISO_LEGAL };
}
