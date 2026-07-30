// Imagem do produto: foto real de estúdio (padrão) x ARTE ILUSTRATIVA de recipiente.
//
// Nem todo produto do catálogo tem foto de estúdio. Antes esses caíam no
// `_generico.svg` (um frasco cinza com "?"), que não dizia nada e ainda podia
// contradizer a embalagem cotada. Agora caem na arte do RECIPIENTE correspondente ao
// tamanho, seguindo a convenção de embalagem do catálogo Indeba (Gustavo, jul/2026):
//
//   ml/1 → frasco      5 (L/kg) → galão      20 (L/kg) → balde
//   50 (L/kg) → bombona azul    200 → tambor       1000 → IBC
//
// Os tamanhos em kg são os MESMOS recipientes pesados (tamanho em kg = litros ×
// densidade): 6,2 kg = galão de 5 L de um produto d≈1,24; 62 kg = bombona de 50 L do
// mesmo produto. Por isso a faixa é por volume equivalente, não por número exato.
//
// E o inverso também vale: quem TEM foto de estúdio tem UMA foto, de UM recipiente. O
// Texspar DSA é vendido em 20 L e 50 L, e a foto é a bombona de 50 L — cotar 20 L
// mostrava ao cliente uma embalagem que não era a dele (lista do Gustavo, jul/2026). Daí
// `fotoEmbalagem` no catálogo (qual recipiente a foto mostra) + `imagemDaEmbalagem`
// abaixo: foto quando o recipiente cotado é o da foto, arte do recipiente certo quando
// não é. Foto errada nunca — é a embalagem que o cliente vai receber.
//
// Toda arte ilustrativa mora em /produtos/_*.svg — é esse prefixo que a UI e o PDF
// usam para exibir o selo "imagem ilustrativa" (nunca passamos desenho por foto).

export const ARTE_GALAO = "/produtos/_galao-5l.svg";
export const ARTE_BALDE = "/produtos/_balde-20.svg";
export const ARTE_TONEL = "/produtos/_tonel-50.svg";
export const ARTE_TAMBOR = "/produtos/_tambor-200.svg";
export const ARTE_IBC = "/produtos/_ibc-1000.svg";
export const ARTE_FRASCO = "/produtos/_frasco.svg";
export const ARTE_GENERICA = "/produtos/_generico.svg"; // item próprio (fora do catálogo)

export type UnidadeEmbalagem = "L" | "kg" | "un" | "ml";

/** Imagem que NÃO é foto do produto — arte de recipiente ou o genérico antigo. */
export function imagemEhIlustrativa(imagemPath: string | null | undefined): boolean {
  return !!imagemPath && /^\/produtos\/_/.test(imagemPath);
}

/**
 * Arte do recipiente para uma embalagem. `kg` e `L` compartilham a mesma faixa: o
 * peso é o volume do recipiente vezes a densidade, então 23 kg continua sendo o
 * balde de 20 L e 58 kg continua sendo a bombona de 50 L.
 */
export function arteDoRecipiente(tamanho: number, unidade: UnidadeEmbalagem): string {
  if (unidade === "ml") return ARTE_FRASCO;
  if (unidade === "un") return ARTE_GENERICA; // "unidade" não diz recipiente nenhum
  if (tamanho <= 1) return ARTE_FRASCO; // 1 L / 900 g de bancada
  if (tamanho <= 9) return ARTE_GALAO; // 5 L (e seus equivalentes em kg: 5,3 / 6,2 / 7,5)
  if (tamanho <= 29) return ARTE_BALDE; // 20 L / 20 kg (21 / 22 / 23 kg)
  if (tamanho <= 119) return ARTE_TONEL; // bombona de 50 L (53 / 58 / 62 / 65 / 66 / 75 kg)
  if (tamanho <= 600) return ARTE_TAMBOR; // tambor de 200 L (200 / 220 kg)
  return ARTE_IBC; // granel: IBC de 1000 L (1000 L / 1240 kg)
}

/**
 * Chave do mapa de imagens do PDF: produto + embalagem cotada, NÃO só o código. O mesmo
 * produto pode estar na proposta duas vezes em tamanhos diferentes (5 L e 20 L são duas
 * linhas próprias, cada uma com preço e quantidade). Desde que a imagem passou a seguir a
 * embalagem cotada, chavear só por código fazia a segunda linha sobrescrever a primeira —
 * as duas saíam com o recipiente da última.
 */
export function chaveImagem(item: { codigo: string; embalagens: { tamanho: number; unidade: string }[] }): string {
  const e = item.embalagens[0];
  return e ? `${item.codigo}#${e.tamanho}${e.unidade}` : item.codigo;
}

export type EmbalagemImagem = {
  tamanho: number;
  unidade: UnidadeEmbalagem;
  /** Foto específica desse tamanho, quando o catálogo tiver uma. Vence tudo. */
  imagemPath?: string | null;
};

export type ProdutoImagem = {
  imagemPath: string;
  /** Recipiente que a foto de estúdio mostra. Ausente = foto serve para qualquer tamanho. */
  fotoEmbalagem?: { tamanho: number; unidade: UnidadeEmbalagem } | null;
};

/** Dois tamanhos vêm no MESMO recipiente físico (23 kg e 20 L, ambos o balde de 20). */
export function mesmoRecipiente(a: EmbalagemImagem, b: { tamanho: number; unidade: UnidadeEmbalagem }): boolean {
  return arteDoRecipiente(a.tamanho, a.unidade) === arteDoRecipiente(b.tamanho, b.unidade);
}

/**
 * Imagem que representa a embalagem COTADA — não "a imagem do produto".
 *
 * 1. foto do próprio tamanho, se cadastrada (`embalagens[].imagemPath`);
 * 2. produto que já não tem foto (imagemPath é arte): arte do recipiente COTADO — o
 *    catálogo fixa uma arte só, e ela não pode continuar sendo a de 20 L quando o
 *    consultor cotou 50 L (Texspar DTT, Primmax Citrus);
 * 3. foto do produto, quando ela mostra o recipiente cotado (ou quando o catálogo não
 *    diz qual recipiente ela mostra — comportamento antigo, sem regressão);
 * 4. arte do recipiente cotado — a foto existe, mas é de outro recipiente.
 */
export function imagemDaEmbalagem(produto: ProdutoImagem, embalagem: EmbalagemImagem | undefined): string {
  if (!embalagem) return produto.imagemPath;
  if (embalagem.imagemPath) return embalagem.imagemPath;
  if (imagemEhIlustrativa(produto.imagemPath)) return arteDoRecipiente(embalagem.tamanho, embalagem.unidade);
  if (!produto.fotoEmbalagem) return produto.imagemPath;
  return mesmoRecipiente(embalagem, produto.fotoEmbalagem)
    ? produto.imagemPath
    : arteDoRecipiente(embalagem.tamanho, embalagem.unidade);
}

export type ProdutoComEmbalagens = ProdutoImagem & { embalagens: EmbalagemImagem[] };

/**
 * Imagem da embalagem cotada quando a cotada NÃO vem do catálogo — é o caso de todo mundo
 * que monta proposta: a tela manual e o orçamento importado mandam tamanho, preço e
 * diluição, e não a `imagemPath` daquele tamanho, que é dado do catálogo e não tem por que
 * voltar no payload. Sem re-hidratar, a regra 1 de `imagemDaEmbalagem` ("foto do próprio
 * tamanho vence tudo") nunca disparava por esses caminhos e 29 pares que TÊM foto do
 * recipiente certo (Texspar DSA 20 L, Autocar Plus 200 kg, City T Líquido 5 L…) saíam com a
 * arte ilustrativa — desenho no lugar da foto do que o cliente vai receber (QA de
 * navegador, 29/07). Casa por tamanho+unidade, que é a chave da embalagem no catálogo.
 */
export function imagemDaCotada(produto: ProdutoComEmbalagens, cotada: EmbalagemImagem | undefined): string {
  if (!cotada || cotada.imagemPath) return imagemDaEmbalagem(produto, cotada);
  const doCatalogo = produto.embalagens.find((c) => c.tamanho === cotada.tamanho && c.unidade === cotada.unidade);
  return imagemDaEmbalagem(produto, doCatalogo?.imagemPath ? { ...cotada, imagemPath: doCatalogo.imagemPath } : cotada);
}
