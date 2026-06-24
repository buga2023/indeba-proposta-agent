/**
 * Análise contábil em linguagem natural (IA-TEXTO). A IA recebe os números JÁ apurados pelo
 * motor — só comenta a saúde e os achados. Nunca recalcula nem fecha balanço (§2). Sem
 * Ollama, devolve um resumo determinístico. Sempre lembra de validar com o contador.
 */
import type { ContabilResponse } from "../contracts";
import { gerarTexto, ollamaDisponivel } from "../llm/ollama";

function resumoFixo(r: ContabilResponse): string {
  const linhas: string[] = [];
  linhas.push(r.partidaDobradaOk ? `Partida dobrada OK (Σdébitos = Σcréditos = R$ ${r.totalDebitos}).` : `ATENÇÃO: partida dobrada NÃO bate.`);
  if (r.bp) linhas.push(`Balanço ${r.bp.fecha ? "fecha" : "NÃO fecha"}: Ativo R$ ${r.bp.totalAtivo} = Passivo R$ ${r.bp.totalPassivo} + PL R$ ${r.bp.totalPL} + Resultado R$ ${r.bp.resultado}.`);
  if (r.dre) linhas.push(`DRE: receitas R$ ${r.dre.totalReceitas} − custos R$ ${r.dre.totalCustos} − despesas R$ ${r.dre.totalDespesas} = resultado R$ ${r.dre.resultado}.`);
  if (r.divergencias.length) linhas.push(`${r.divergencias.length} divergência(s) a revisar.`);
  linhas.push("Confira com o contador.");
  return linhas.join(" ");
}

export async function resumirContabil(r: ContabilResponse): Promise<string> {
  if (!(await ollamaDisponivel())) return resumoFixo(r);
  const prompt = `Você é um analista contábil. Comente em português, de forma objetiva, a saúde a partir dos números JÁ apurados (não recalcule, não invente). Aponte se a partida dobrada bate, se o balanço fecha, o resultado do período e as divergências. Termine lembrando de validar com o contador.

Partida dobrada: ${r.partidaDobradaOk ? "OK" : "NÃO BATE"} (débitos R$ ${r.totalDebitos}, créditos R$ ${r.totalCreditos}).
${r.bp ? `BP: Ativo R$ ${r.bp.totalAtivo}, Passivo R$ ${r.bp.totalPassivo}, PL R$ ${r.bp.totalPL}, Resultado R$ ${r.bp.resultado}, fecha=${r.bp.fecha}.` : "BP não gerado (faltou plano de contas)."}
${r.dre ? `DRE: receitas R$ ${r.dre.totalReceitas}, custos R$ ${r.dre.totalCustos}, despesas R$ ${r.dre.totalDespesas}, resultado R$ ${r.dre.resultado}.` : ""}
Divergências: ${r.divergencias.length ? r.divergencias.map((d) => d.descricao).join("; ") : "nenhuma"}.

Análise:`;
  try {
    const t = (await gerarTexto(prompt)).trim();
    return t || resumoFixo(r);
  } catch {
    return resumoFixo(r);
  }
}
