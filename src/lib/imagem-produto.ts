// Imagem do produto: foto real de estúdio (padrão) x ARTE ILUSTRATIVA de recipiente.
//
// Nem todo produto do catálogo tem foto de estúdio. Antes esses caíam no
// `_generico.svg` (um frasco cinza com "?"), que não dizia nada e ainda podia
// contradizer a embalagem cotada. Agora caem na arte do RECIPIENTE correspondente ao
// tamanho, seguindo a convenção de embalagem do catálogo Indeba (Gustavo, jul/2026):
//
//   5 (L/kg)  → galão      20 (L/kg) → balde      50 (L/kg) → tonel azul
//   ml        → frasco
//
// Os tamanhos em kg são os MESMOS recipientes pesados (tamanho em kg = litros ×
// densidade): 6,2 kg = galão de 5 L de um produto d≈1,24; 62 kg = tonel de 50 L do
// mesmo produto. Por isso a faixa é por volume equivalente, não por número exato.
//
// Toda arte ilustrativa mora em /produtos/_*.svg — é esse prefixo que a UI e o PDF
// usam para exibir o selo "imagem ilustrativa" (nunca passamos desenho por foto).

export const ARTE_GALAO = "/produtos/_galao-5l.svg";
export const ARTE_BALDE = "/produtos/_balde-20.svg";
export const ARTE_TONEL = "/produtos/_tonel-50.svg";
export const ARTE_FRASCO = "/produtos/_frasco.svg";
export const ARTE_GENERICA = "/produtos/_generico.svg"; // item próprio (fora do catálogo)

/** Imagem que NÃO é foto do produto — arte de recipiente ou o genérico antigo. */
export function imagemEhIlustrativa(imagemPath: string | null | undefined): boolean {
  return !!imagemPath && /^\/produtos\/_/.test(imagemPath);
}

/**
 * Arte do recipiente para uma embalagem. `kg` e `L` compartilham a mesma faixa: o
 * peso é o volume do recipiente vezes a densidade, então 23 kg continua sendo o
 * balde de 20 L e 58 kg continua sendo o tonel de 50 L.
 */
export function arteDoRecipiente(tamanho: number, unidade: "L" | "kg" | "un" | "ml"): string {
  if (unidade === "ml") return ARTE_FRASCO;
  if (unidade === "un") return ARTE_GENERICA; // "unidade" não diz recipiente nenhum
  if (tamanho <= 1) return ARTE_FRASCO; // 1 L / 900 g de bancada
  if (tamanho <= 9) return ARTE_GALAO; // 5 L (e seus equivalentes em kg: 5,3 / 6,2 / 7,5)
  if (tamanho <= 29) return ARTE_BALDE; // 20 L / 20 kg (21 / 22 / 23 kg)
  return ARTE_TONEL; // 50 L pra cima (53 / 58 / 62 / 66 / 75 kg, tambores e IBC)
}
