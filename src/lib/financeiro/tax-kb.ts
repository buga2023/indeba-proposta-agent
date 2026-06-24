/**
 * Base de conhecimento tributária (porta `src/tax_kb.py`).
 *
 * As alíquotas vêm de `tax-rules.json` (editável), NUNCA da memória do Qwen. Assim o
 * cálculo de imposto é auditável e o usuário controla os valores (constituição §2).
 */
import { fmt } from "./engine";
import type { ResultadoMotor } from "./engine";
import taxRules from "./tax-rules.json";

type Regime = { descricao?: string; impostos: Record<string, number> };
type KB = { regimes?: Record<string, Regime> };

const KB_PADRAO = taxRules as KB;

export function aliquota(regime: string, imposto: string, kb: KB = KB_PADRAO): number | null {
  const r = regime ? kb.regimes?.[String(regime).toLowerCase()] : undefined;
  if (!r) return null;
  const aliq = r.impostos?.[String(imposto).toUpperCase()];
  return typeof aliq === "number" ? aliq : null;
}

export function calcularImposto(
  base: number,
  regime: string,
  imposto: string,
  kb: KB = KB_PADRAO,
): ResultadoMotor {
  const aliq = aliquota(regime, imposto, kb);
  if (aliq === null) {
    return {
      ok: false,
      erro:
        `Alíquota de ${imposto} no regime '${regime}' não está cadastrada. ` +
        "Edite tax-rules.json para incluí-la.",
    };
  }
  const valor = Math.round(((base * aliq) / 100) * 100) / 100;
  const resumo =
    `${String(imposto).toUpperCase()} (${regime}): base R$ ${fmt(base)} × ${aliq}% = R$ ${fmt(valor)}. ` +
    "Alíquota vinda da sua base tributária — confirme com o contador.";
  return {
    ok: true,
    tipo: "calcular_imposto",
    imposto: String(imposto).toUpperCase(),
    regime,
    base,
    aliquota: aliq,
    valor,
    resumoNumerico: resumo,
  };
}
