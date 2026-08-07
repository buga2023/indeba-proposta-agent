import type { FichaProduto, Produto } from "./contracts";

// Como uma edição de produto se combina com o que já estava gravado.
//
// A versão anterior substituía o registro inteiro pelo que o formulário mandava, e isso
// apagava dado em silêncio: a tela do Catálogo recebe a ficha RECORTADA (só título e
// descrição — ver app/api/catalogo/route.ts, que corta 104 KB por request), então o
// formulário abria sem benefícios, diluições, características nem subtítulo e devolvia um
// produto sem eles. Foi o que o Matheus relatou em 06/08/2026: trocou só a foto do Primmax
// Inox e "salvou com a foto e apagou as informações"; no Sanquat, apagou uma embalagem
// errada e perdeu o resto.
//
// Duas defesas, e as duas são necessárias:
//  1. o formulário passa a abrir com o produto COMPLETO (GET /api/produtos/<codigo>);
//  2. o que ele NÃO envia é preservado daqui — inclusive campo que ele nem conhece.
//
// A regra que faz as duas conviverem: `undefined` significa "não mexi nisso", e vazio
// (string em branco, lista sem itens) significa "apaguei isto". Por isso o formulário manda
// os campos que ele controla SEMPRE, com string vazia quando o gestor limpou o campo — sem
// essa distinção, apagar o subtítulo seria indistinguível de não ter subtítulo na tela, e o
// merge devolveria o valor antigo para sempre.

const vazio = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

// Tira as chaves vazias para não gravar `titulo: ""` — a ficha é lida com truthiness pelo
// template do PDF, e um campo em branco vira painel vazio no documento do cliente.
function podar<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => !vazio(v))) as Partial<T>;
}

export function mesclarFicha(
  atual: FichaProduto | null | undefined,
  nova: FichaProduto | null | undefined,
): FichaProduto | null {
  if (nova === undefined) return atual ?? null;
  const base = atual ?? {};
  // `caracteristicas` é o único bloco aninhado: o formulário mostra pH, aspecto, cor e odor,
  // mas o catálogo também guarda uso, densidade e cloro ativo. Mesclado à parte para que
  // editar a cor não apague a densidade que veio da ficha técnica.
  const caracteristicas = podar({ ...(base.caracteristicas ?? {}), ...((nova ?? {}).caracteristicas ?? {}) });
  const junta: FichaProduto = {
    ...base,
    ...(nova ?? {}),
    ...(Object.keys(caracteristicas).length ? { caracteristicas } : { caracteristicas: undefined }),
  };
  const limpa = podar(junta) as FichaProduto;
  return Object.keys(limpa).length ? limpa : null;
}

/** O que vai para a coluna `dados`: o produto atual com a edição por cima, sem perder o que
 *  a tela não mostra (`fotoEmbalagem`, e qualquer campo que venha a existir antes do
 *  formulário aprender a exibi-lo). */
export function mesclarProduto(atual: Produto | null | undefined, novo: Produto): Produto {
  if (!atual) return { ...novo, ficha: mesclarFicha(null, novo.ficha) };
  const junta: Produto = { ...atual, ...podar(novo), ficha: mesclarFicha(atual.ficha, novo.ficha) };
  // `podar` protege os campos opcionais, mas os obrigatórios são responsabilidade do Zod na
  // entrada — vêm sempre preenchidos, e `embalagens`/`funcoes` chegam com o que a tela
  // mostrou. Substituição é o comportamento certo aí: apagar uma embalagem errada precisa
  // apagar de fato (foi o segundo relato do Matheus, no Sanquat).
  return { ...junta, embalagens: novo.embalagens, funcoes: novo.funcoes, metodos: novo.metodos, segmentos: novo.segmentos };
}
