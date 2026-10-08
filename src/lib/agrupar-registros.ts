/**
 * Agrupa registros por ANO > MÊS para as pastas colapsáveis das Ferramentas
 * (visitas técnicas e comerciais). Regra, não desenho: a tela só renderiza o resultado.
 *
 * - Ordem decrescente: ano mais recente primeiro, e dentro dele o mês mais recente.
 * - `ano` = "2026"; `mes` = "01".."12" (dois dígitos, o rótulo em português é da tela).
 * - Data nula, vazia ou inválida cai no bucket "Sem data" (ano e mês iguais a SEM_DATA),
 *   sempre por último.
 * - A ordem dos itens dentro do mês é a da entrada (estável).
 * - Datas AAAA-MM-DD são lidas pelo texto, sem `new Date`, para não deslocar o dia por fuso.
 */
export const SEM_DATA = "Sem data";

function anoMes(data: string | Date | null | undefined): { ano: string; mes: string } | null {
  if (data == null) return null;
  if (data instanceof Date) {
    if (Number.isNaN(data.getTime())) return null;
    return { ano: String(data.getFullYear()), mes: String(data.getMonth() + 1).padStart(2, "0") };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data).trim());
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { ano: m[1], mes: m[2] };
}

export function agruparPorAnoMes<T extends { data?: string | Date | null }>(
  itens: T[],
): Array<{ ano: string; meses: Array<{ mes: string; itens: T[] }> }> {
  const anos = new Map<string, Map<string, T[]>>();
  for (const item of itens) {
    const k = anoMes(item.data) ?? { ano: SEM_DATA, mes: SEM_DATA };
    let meses = anos.get(k.ano);
    if (!meses) anos.set(k.ano, (meses = new Map()));
    const lista = meses.get(k.mes);
    if (lista) lista.push(item);
    else meses.set(k.mes, [item]);
  }
  const desc = (a: string, b: string) => {
    if (a === SEM_DATA) return 1;
    if (b === SEM_DATA) return -1;
    return b.localeCompare(a);
  };
  return [...anos.keys()].sort(desc).map((ano) => ({
    ano,
    meses: [...anos.get(ano)!.keys()].sort(desc).map((mes) => ({ mes, itens: anos.get(ano)!.get(mes)! })),
  }));
}
