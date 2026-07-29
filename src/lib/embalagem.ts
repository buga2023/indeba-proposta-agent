// Rótulo de tamanho de embalagem — o texto que o CLIENTE lê ("5 L", "5,3 kg", "800 ml").
//
// O catálogo guarda `tamanho` como número e os templates interpolavam direto
// (`${e.tamanho} ${e.unidade}`), o que imprime o separador decimal do JavaScript: o
// Primmax Hort FLV saía "5.3 kg" no PDF (screenshot do Matheus, 29/07). Os tamanhos
// quebrados são justamente os kg (o mesmo recipiente pesado — 5,3 kg é o galão de 5 L
// de um produto d≈1,06; ver a convenção em imagem-produto.ts), então isso aparece em
// proposta de verdade, não é caso de borda.
//
// Aqui o número passa por pt-BR: vírgula decimal e ponto de milhar ("1.240 kg", do
// IBC do Primmax CIP DTX). Inteiro continua sem casas — "5 L", nunca "5,0 L".
export function tamanhoLegivel(tamanho: number, unidade: string): string {
  const n = Number(tamanho);
  const numero = Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : String(tamanho);
  return `${numero} ${unidade}`;
}
