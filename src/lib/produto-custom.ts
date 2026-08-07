// Produtos cadastrados PELA TELA (Catálogo → Novo produto), guardados no Postgres.
//
// Por que existem duas fontes de produto: `data/catalogo.json` traz os 150 da base
// INDEBA/PRATT e é arquivo versionado — a função da Vercel é somente-leitura, então cadastrar
// pela interface exigia outro lugar para gravar. Os dois lados falam o MESMO contrato Zod
// (`Produto`), então quem consome (vitrine, matcher, RAG, PDF) não sabe de onde veio.
// Ver docs/spec-cadastro-produto.md.
import { prisma } from "@/lib/db";
import { Produto } from "@/lib/contracts";
import { produtoPorCodigo } from "@/lib/catalogo";

// Foto e ficha não viajam no `dados`: são bytes, e servi-los por rota mantém o payload do
// catálogo do mesmo tamanho de antes. Estes são os caminhos que o produto carrega.
export const caminhoImagem = (codigo: string) => `/api/produtos/${encodeURIComponent(codigo)}/imagem`;
export const caminhoFicha = (codigo: string) => `/api/produtos/${encodeURIComponent(codigo)}/ficha`;

// `imagemPath`/`fichaTecnicaPath` são DERIVADOS do código, nunca confiados ao que veio
// gravado: assim um `dados` antigo (ou adulterado) não aponta para fora do sistema.
//
// Sem anexo próprio, a linha HERDA o da base: uma linha desta tabela pode ser o override de
// um produto do data/catalogo.json (o gestor corrigiu o preço de um dos ~150), e aí a foto e
// a ficha continuam sendo as versionadas em public/. O fallback também vem do JSON — fonte
// nossa, não do cliente —, então a garantia acima continua de pé.
function comCaminhos(codigo: string, dados: unknown, temFicha: boolean, temImagem: boolean): Produto | null {
  const r = Produto.safeParse(dados);
  if (!r.success) {
    console.error(`[produto-custom] ${codigo} fora do contrato — fora do catálogo:`, r.error.flatten());
    return null;
  }
  const base = produtoPorCodigo(codigo);
  return {
    ...r.data,
    codigo,
    imagemPath: temImagem ? caminhoImagem(codigo) : (base?.imagemPath ?? caminhoImagem(codigo)),
    fichaTecnicaPath: temFicha ? caminhoFicha(codigo) : (base?.fichaTecnicaPath ?? null),
  };
}

// Lista tolerante a linha podre, mesma postura de `listarPropostas`: um produto fora do
// contrato é registrado e pulado — perder um da lista é ruim, derrubar o catálogo inteiro
// (que é o que um throw aqui faria, já que isto alimenta a vitrine E o PDF) é pior.
//
// Linha com `excluido` não entra: ela não é mais um produto, é a marca de que um código
// SAIU do catálogo — inclusive um da base, que continua no JSON e por isso precisa ser
// removido na leitura para de fato sumir (ver `excluidosCustom`).
export async function listarProdutosCustom(): Promise<Produto[]> {
  const linhas = await prisma.produtoCustom.findMany({
    where: { excluido: false },
    select: { codigo: true, dados: true, fichaMime: true, imagemMime: true },
    orderBy: { criadoEm: "desc" },
  });
  return linhas
    .map((l) => comCaminhos(l.codigo, l.dados, l.fichaMime !== null, l.imagemMime !== null))
    .filter((p): p is Produto => p !== null);
}

// Os códigos com lápide. Quem une as duas fontes (`catalogoCompleto`) precisa deles para
// tirar do JSON o produto da base que o gestor excluiu — sem isso, excluir um dos ~150 não
// faria nada visível e o gestor concluiria que o botão não funciona.
export async function excluidosCustom(): Promise<string[]> {
  const linhas = await prisma.produtoCustom.findMany({
    where: { excluido: true },
    select: { codigo: true },
  });
  return linhas.map((l) => l.codigo);
}

// Os excluídos com nome, para o painel de restauração do gestor. O nome sai do que estava
// gravado; se a linha for a lápide de um produto da base que nunca chegou a ser editado,
// `dados` traz a cópia gravada no momento da exclusão — e o JSON é o último recurso.
export async function listarExcluidos(): Promise<{ codigo: string; nome: string }[]> {
  const linhas = await prisma.produtoCustom.findMany({
    where: { excluido: true },
    select: { codigo: true, dados: true },
    orderBy: { atualizadoEm: "desc" },
  });
  return linhas.map((l) => {
    const nome = (l.dados as { nome?: unknown } | null)?.nome;
    return { codigo: l.codigo, nome: typeof nome === "string" && nome ? nome : produtoPorCodigo(l.codigo)?.nome ?? l.codigo };
  });
}

// Estado de UM código nesta tabela, em uma consulta só. "Sem linha" e "linha com lápide"
// são respostas diferentes para quem une as fontes: a primeira manda cair no JSON, a segunda
// manda tratar o produto como inexistente mesmo que o JSON ainda o traga.
export async function linhaCustom(codigo: string): Promise<{ produto: Produto | null; excluido: boolean } | null> {
  const l = await prisma.produtoCustom.findUnique({
    where: { codigo },
    select: { codigo: true, dados: true, fichaMime: true, imagemMime: true, excluido: true },
  });
  if (!l) return null;
  if (l.excluido) return { produto: null, excluido: true };
  return { produto: comCaminhos(l.codigo, l.dados, l.fichaMime !== null, l.imagemMime !== null), excluido: false };
}

export async function produtoCustomPorCodigo(codigo: string): Promise<Produto | null> {
  return (await linhaCustom(codigo))?.produto ?? null;
}

export async function imagemDoProduto(codigo: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const l = await prisma.produtoCustom.findUnique({ where: { codigo }, select: { imagem: true, imagemMime: true } });
  // Override que herdou a foto da base não tem bytes: quem chama devolve 404 e o navegador
  // segue para o arquivo versionado, que é para onde o `imagemPath` deste produto aponta.
  if (!l?.imagem || !l.imagemMime) return null;
  return { bytes: Buffer.from(l.imagem), mime: l.imagemMime };
}

export async function fichaDoProduto(codigo: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const l = await prisma.produtoCustom.findUnique({ where: { codigo }, select: { ficha: true, fichaMime: true } });
  if (!l?.ficha || !l.fichaMime) return null;
  return { bytes: Buffer.from(l.ficha), mime: l.fichaMime };
}

// O código no path de /api/produtos/<codigo>/imagem chega do cliente. Só serve para procurar
// uma linha por chave única — nunca vira caminho de arquivo, então não há travessia possível.
export function codigoDaRotaDeImagem(caminho: string): string | null {
  const m = /^\/api\/produtos\/([^/]+)\/imagem$/.exec(caminho);
  return m ? decodeURIComponent(m[1]) : null;
}
