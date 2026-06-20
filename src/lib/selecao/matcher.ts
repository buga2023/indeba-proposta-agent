import type { Produto } from "../contracts";
import type { FacetasDetectadas } from "../contracts";
import type { SelecaoExplicada, SelecaoItem } from "../contracts";

// Recuperação híbrida (spec §2), versão determinística do MVP:
//   1. filtro duro    por F1.Linha (∩ não-vazia) — se o briefing não citou linha, não filtra
//   2. overlap        soma facetas batidas em F2/F3/F4 → score
//   3. desempate      por score; o passo semântico (IA) entra no Marco 2 completo
// A IA nunca emite preço/produto aqui — só pontua o que JÁ existe no catálogo.
export function selecionar(
  produtos: Produto[],
  facetas: FacetasDetectadas,
  limite = 8,
): SelecaoExplicada {
  const ativos = produtos.filter((p) => p.ativo);

  // 1. filtro duro por linha (só quando o briefing detectou alguma linha)
  const filtrados =
    facetas.linha.length > 0
      ? ativos.filter((p) => facetas.linha.includes(p.linha))
      : ativos;

  const itens: SelecaoItem[] = filtrados
    .map((p) => pontuar(p, facetas))
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);

  return { itens };
}

function pontuar(p: Produto, f: FacetasDetectadas): SelecaoItem {
  const batidas: string[] = [];

  if (f.linha.includes(p.linha)) batidas.push(`F1:${p.linha}`);
  for (const s of f.segmento) if (p.segmentos.includes(s)) batidas.push(`F2:${s}`);
  for (const fn of f.funcao) if (p.funcoes.includes(fn)) batidas.push(`F3:${fn}`);
  for (const m of f.metodo) if (p.metodos.includes(m)) batidas.push(`F4:${m}`);

  // pesos: função e segmento pesam mais que método/linha
  const peso = (t: string) =>
    t.startsWith("F3") ? 3 : t.startsWith("F2") ? 2 : t.startsWith("F4") ? 1.5 : 1;
  const score = batidas.reduce((acc, t) => acc + peso(t), 0);

  return {
    codigo: p.codigo,
    score,
    facetasBatidas: batidas,
    motivo: batidas.length
      ? `Casou em ${batidas.join(", ")}.`
      : "Sem casamento de faceta.",
    procedencia: "IA-SELEÇÃO",
  };
}
