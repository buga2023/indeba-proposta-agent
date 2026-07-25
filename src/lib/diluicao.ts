import type { Embalagem, FichaProduto } from "./contracts";

// Valor por litro DILUÍDO — o número que o vendedor usa pra defender preço ("o
// principal", áudio do Matheus 24/07): o preço da embalagem cotada não diz nada
// sozinho; R$ 90,00 num produto que rende 1:1000 é R$ 0,018 por litro de solução
// pronta. Aqui o cálculo sai da diluição REAL da ficha técnica (nunca inventada) —
// texto livre do catálogo → fator numérico → custo.

// Número em PT-BR ("0,30" / "03" / "1,5") → Number.
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

const N = String.raw`\d+(?:[.,]\d+)?`;

// Todos os fatores de diluição que um texto de diluição carrega. FATOR = partes de
// solução pronta por parte de produto (1:100 → 100). As 4 formas que o catálogo usa:
//   "1:250"                                   → 250
//   "2 partes ... para até 100 partes"        → 50   (100/2)
//   "de 0,10% a 0,30%"                        → 1000 e 333 (100/%)
//   "100 mL do produto para 10 litros"        → 100  (10 000 mL / 100 mL)
// Em faixas ("1 a 4 partes", "0,10% a 0,30%") a MENOR concentração é a maior
// diluição — é ela que responde "rende até quanto?".
export function fatoresDiluicao(texto: string): number[] {
  const t = String(texto ?? "").toLowerCase();
  const out: number[] = [];
  const push = (f: number) => {
    if (Number.isFinite(f) && f > 1) out.push(f);
  };

  for (const m of t.matchAll(new RegExp(`(${N})\\s*:\\s*(${N})`, "g"))) push(num(m[2]) / num(m[1]));
  // "X (a Y) parte(s) …de produto… para (até) Z partes" — X é a menor da faixa.
  for (const m of t.matchAll(new RegExp(`(${N})(?:\\s*a\\s*${N})?\\s*partes?[^.;]*?para\\s*(?:at[ée]\\s*)?(${N})\\s*partes?`, "g")))
    push(num(m[2]) / num(m[1]));
  for (const m of t.matchAll(new RegExp(`(${N})\\s*%`, "g"))) push(100 / num(m[1]));
  // "A mL … para/em B litros" (B em litros → mL para dividir por A)
  for (const m of t.matchAll(new RegExp(`(${N})\\s*ml[^.;]*?(?:para|em)\\s*(${N})\\s*(?:l\\b|litros?)`, "g")))
    push((num(m[2]) * 1000) / num(m[1]));

  return out;
}

// Maior diluição declarada na ficha ("rende até 1:X") — varre TODAS as linhas de
// diluição do produto. Sem ficha, cai no `diluicaoMax` da embalagem (dado de
// catálogo, também real). null quando o produto não tem diluição cadastrada.
export function diluicaoMaxima(ficha: FichaProduto | null | undefined, embalagens: Embalagem[]): number | null {
  const daFicha = (ficha?.diluicoes ?? []).flatMap((d) => fatoresDiluicao(`${d.uso} ${d.razao}`));
  if (daFicha.length) return Math.max(...daFicha);
  const daEmbalagem = embalagens.flatMap((e) => (e.diluicaoMax ? fatoresDiluicao(e.diluicaoMax) : []));
  return daEmbalagem.length ? Math.max(...daEmbalagem) : null;
}

// Litros equivalentes da embalagem (kg conta como litro — é assim que a diluição
// "1 parte para 100 partes" é aplicada na operação; `un` não tem volume: fora).
function litros(e: Embalagem): number | null {
  if (e.unidade === "L" || e.unidade === "kg") return e.tamanho;
  if (e.unidade === "ml") return e.tamanho / 1000;
  return null;
}

export type CustoDiluido = { valor: number; fator: number; rotulo: string; texto: string };

// Custo por litro de solução pronta na embalagem COTADA (embalagens[0], convenção
// do app): (preço ÷ litros do produto) ÷ fator de diluição. Confere com o
// `custoDiluido` cadastrado no catálogo — Primmax Sanquat 5 L a R$ 220,00 em 1:250
// → 44,00/250 = R$ 0,18. Calculado do preço REALMENTE cotado (o vendedor pode ter
// mudado o preço na montagem), então nunca fica defasado.
//
// A diluição sai SEMPRE do `diluicaoMax` da embalagem cotada — na Proposta Manual é
// o valor que o consultor digita na montagem ("sempre o consultor", decisão do
// Gustavo 25/07: tira o automático da ficha técnica). Sem diluição na embalagem
// cotada → sem valor por litro diluído (produto pronto pra uso, ou o consultor não
// informou). A ficha continua descrevendo o modo de diluição (painel do template),
// mas não é mais a fonte deste número.
export function custoLitroDiluido(embalagens: Embalagem[]): CustoDiluido | null {
  const cotada = embalagens[0];
  if (!cotada?.diluicaoMax) return null;
  const vol = litros(cotada);
  const preco = Number(cotada.preco);
  const fatores = fatoresDiluicao(cotada.diluicaoMax);
  const fator = fatores.length ? Math.max(...fatores) : null;
  if (!vol || !fator || !Number.isFinite(preco) || preco <= 0) return null;

  const valor = preco / vol / fator;
  // Centavos não bastam num produto que rende 1:1000 (R$ 0,018/L viraria "R$ 0,02",
  // perdendo a ordem de grandeza) — abaixo de 10 centavos, 3 casas.
  const casas = valor < 0.1 ? 3 : 2;
  const rotulo = `1:${fator >= 10 ? Math.round(fator) : fator.toFixed(1).replace(".", ",")}`;
  return {
    valor,
    fator,
    rotulo,
    texto: "R$ " + valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }),
  };
}
