// Persistência da proposta comercial (store de trabalho). Guarda o PropostaScope
// canônico + status MUTÁVEL, espelhando o contrato Zod (src/lib/contracts/proposta.ts).
// Permite reabrir e gerar contrato de uma proposta que já existe. O log append-only
// (lib/log.ts) segue como auditoria imutável de cada PDF emitido (constituição §8).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { produtoPorCodigoCompleto } from "@/lib/catalogo";
import { imagemDaCotada } from "@/lib/imagem-produto";
import {
  PropostaResumo,
  PropostaRegistro,
  StatusProposta,
  type PropostaScope,
} from "@/lib/contracts";

// Σ (preço da 1ª embalagem × quantidade) — mesma convenção determinística do log.ts/gerar.ts.
// Exportada para o teste-guardião: o total persistido vem SEMPRE do catálogo, nunca do modelo.
export function totalDaProposta(scope: PropostaScope): string {
  let total = 0;
  for (const i of scope.itens) {
    const qtd = i.quantidade ?? 1;
    total += (Number(i.embalagens[0]?.preco) || 0) * qtd;
  }
  return total.toFixed(2);
}

type Row = {
  id: string;
  status: string;
  autor: string;
  cliente: string;
  segmento: string | null;
  tipo: string;
  total: Prisma.Decimal;
  scope: Prisma.JsonValue;
  criadoEm: Date;
  atualizadoEm: Date;
};

// `Proposta.status` é String livre no banco (sem CHECK — ver prisma/schema.prisma), então
// nada impede uma linha com valor fora do enum comercial: edição manual no painel do banco
// ou dado anterior ao contrato. Só que `PropostaResumo.parse` lançava nessa linha e o
// `rows.map` derrubava a LISTA INTEIRA com 500 — uma proposta ruim escondia TODO o
// histórico, e sem histórico não dá nem pra reabrir/editar as outras. Normaliza pro
// fallback e registra: a linha continua visível e o select do histórico (PATCH, sempre
// validado) regrava um status válido, curando o registro.
function statusDaLinha(status: string, id: string): StatusProposta {
  const r = StatusProposta.safeParse(status);
  if (r.success) return r.data;
  console.warn(`[propostas] status inválido ${JSON.stringify(status)} na proposta ${id} — exibindo como "rascunho"`);
  return "rascunho";
}

function baseResumo(row: Row) {
  const itens = (row.scope as { itens?: unknown[] } | null)?.itens;
  return {
    id: row.id,
    status: statusDaLinha(row.status, row.id),
    autor: row.autor,
    cliente: row.cliente,
    segmento: row.segmento,
    tipo: row.tipo,
    total: row.total.toFixed(2),
    qtdItens: Array.isArray(itens) ? itens.length : 0,
    criadoEm: row.criadoEm.toISOString(),
    atualizadoEm: row.atualizadoEm.toISOString(),
  };
}

// A imagem do item é um SNAPSHOT resolvido na montagem — e proposta salva antes do fix de
// 29/07 congelou a ARTE ilustrativa em pares que têm foto do recipiente cotado (a tela não
// reenviava a `imagemPath` do tamanho; ver imagemDaCotada em imagem-produto.ts). Corrigir o
// código não desfaz o que está no banco: quem reabre uma proposta antiga continuaria vendo
// o desenho no preview e no PDF. Então a leitura recalcula a imagem a partir do CATÁLOGO —
// mesma cura que `statusDaLinha` faz com status inválido, e coerente com a constituição §1
// (dado crítico vem sempre do catálogo). O auto-save da próxima edição regrava o registro.
// Item próprio (fora do catálogo) e produto que saiu do catálogo ficam como estão: a
// imagem deles não é derivável.
// Assíncrona desde o cadastro de produto pela tela: o catálogo tem duas fontes agora (JSON
// versionado + Postgres), e produto cadastrado pela interface também precisa ter a imagem
// recalculada — senão a proposta que o usa reabre com arte genérica.
export async function comImagensDoCatalogo(scope: PropostaScope): Promise<PropostaScope> {
  let mudou = false;
  const itens = await Promise.all(scope.itens.map(async (it) => {
    const p = await produtoPorCodigoCompleto(it.codigo);
    if (!p) return it;
    const imagemPath = imagemDaCotada(p, it.embalagens[0]);
    if (imagemPath === it.imagemPath) return it;
    mudou = true;
    return { ...it, imagemPath };
  }));
  return mudou ? { ...scope, itens } : scope;
}

// Valida via Zod ao mapear — garante que o que sai do banco respeita o contrato.
const mapearResumo = (row: Row): PropostaResumo => PropostaResumo.parse(baseResumo(row));
const mapearRegistro = async (row: Row): Promise<PropostaRegistro> => {
  const registro = PropostaRegistro.parse({ ...baseResumo(row), scope: row.scope });
  return { ...registro, scope: await comImagensDoCatalogo(registro.scope) };
};

// Auto-save da proposta gerada/editada (upsert pelo id do scope). Na criação entra como
// `rascunho`; em updates o status é PRESERVADO (só muda por atualizarStatusProposta) e o
// `autor` original é mantido.
export async function salvarProposta(scope: PropostaScope, autor: string): Promise<PropostaRegistro> {
  const dados = {
    cliente: scope.cliente.razaoSocial,
    segmento: scope.cliente.segmento ?? null,
    tipo: scope.tipo,
    total: new Prisma.Decimal(totalDaProposta(scope)),
    scope: scope as unknown as Prisma.InputJsonValue,
  };
  const row = await prisma.proposta.upsert({
    where: { id: scope.id },
    create: { id: scope.id, status: "rascunho", autor, ...dados },
    update: dados,
  });
  return await mapearRegistro(row);
}

// Arquivada = tirada de circulação; não entra na listagem nem nos totais do painel a menos
// que o usuário peça. O corte é no WHERE (índice @@index([status]) do schema), não no
// cliente: proposta arquivada não vira linha, não vira JSON e não trafega — o histórico
// tinha 32 de 39 arquivadas, ou seja, 80% do payload era registro que ninguém queria ver.
//
// `autor` recorta a listagem para um vendedor só (undefined = sem recorte, o gestor vê o
// time inteiro). Mesmo motivo do corte de arquivadas, e agora também por sigilo: até
// 01/08/2026 qualquer sessão autenticada recebia o histórico da empresa inteira, com nome
// de cliente e valor de cada proposta dos colegas. O filtro é no WHERE (índice
// @@index([autor])) — proposta de outro vendedor não vira linha, não vira JSON e não trafega.
export async function listarPropostas(
  limite = 200,
  incluirArquivadas = false,
  autor?: string,
): Promise<PropostaResumo[]> {
  const where: Prisma.PropostaWhereInput = {};
  if (!incluirArquivadas) where.status = { not: "arquivada" };
  if (autor) where.autor = autor;
  const rows = await prisma.proposta.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { atualizadoEm: "desc" },
    take: limite,
  });
  // Listagem tolerante a linha podre: `status` já é normalizado em baseResumo, mas qualquer
  // outro campo divergente do contrato (tipo fora do enum, total nulo…) também lançava e
  // levava junto o histórico inteiro. Aqui a linha problemática é PULADA e registrada —
  // perder uma proposta da lista é ruim, perder TODAS é o que estava acontecendo.
  const resumos: PropostaResumo[] = [];
  for (const row of rows) {
    try {
      resumos.push(mapearResumo(row));
    } catch (e) {
      console.error(`[propostas] linha ${row.id} fora do contrato — fora da listagem:`, e);
    }
  }
  return resumos;
}

export async function obterProposta(id: string): Promise<PropostaRegistro | null> {
  const row = await prisma.proposta.findUnique({ where: { id } });
  return row ? await mapearRegistro(row) : null;
}

// Só o dono, sem carregar a proposta. O gate de autoria (ver /api/propostas e
// /api/propostas/[id]) precisa de UMA string, mas vinha chamando `obterProposta`: isso traz
// o `scope` inteiro do Postgres — o JSON com todos os itens da proposta —, roda o Zod em
// cima dele e ainda recalcula a imagem de cada item pelo catálogo (`comImagensDoCatalogo`),
// tudo para descartar o resultado e ler `.autor`. No auto-save é o caminho mais quente do
// app. Aqui é a mesma busca por chave primária devolvendo uma coluna.
export async function autorDaProposta(id: string): Promise<string | null> {
  const row = await prisma.proposta.findUnique({ where: { id }, select: { autor: true } });
  return row?.autor ?? null;
}

export async function atualizarStatusProposta(id: string, status: StatusProposta): Promise<PropostaRegistro> {
  const row = await prisma.proposta.update({ where: { id }, data: { status } });
  return await mapearRegistro(row);
}
