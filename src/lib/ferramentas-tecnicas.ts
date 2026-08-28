import { prisma } from "@/lib/db";
import {
  VisitaCarteira,
  type VisitaCarteiraCreate,
  type VisitaCarteiraUpdate,
  ContratoComodato,
  type ContratoComodatoCreate,
  type ContratoComodatoUpdate,
  EstoqueComodato,
  type EstoqueComodatoCreate,
  type EstoqueComodatoUpdate,
} from "@/lib/contracts";
import type { SessaoUsuario } from "@/lib/auth";
import { anexosDe } from "@/lib/anexos";

// Recorte único do módulo (áudio do Mateus, 21/08/2026: "todo mundo tem acesso a escrever…
// só não ter acesso aos registros de todo mundo, apenas os deles"): gestor vê tudo,
// vendedor vê só o que é dele. Mesmo desenho de listarChamados/listarPropostas.
function escopo(usuario: SessaoUsuario) {
  return usuario.papel === "admin" ? {} : { autor: usuario.email };
}

// Lápide da aba Excluídos (áudio do Mateus, 25/08/2026): excluir marca `excluidoEm`; as
// listagens normais filtram os vivos, a aba Excluídos lista as lápides — de onde o gestor
// restaura ou exclui definitivamente.
const vivos = { excluidoEm: null } as const;
const lapides = { excluidoEm: { not: null } } as const;

const iso = <T extends { criadoEm: Date; atualizadoEm: Date }>(row: T) => ({
  ...row,
  criadoEm: row.criadoEm.toISOString(),
  atualizadoEm: row.atualizadoEm.toISOString(),
});

/* ───────── Registro de Visitas da Carteira ───────── */

// Os bytes dos anexos (fotos/documento) nunca trafegam na listagem: o select fica nos
// campos leves + ids das fotos, e as rotas /api/visitas/<id>/fotos/<fotoId> e
// .../documento servem o conteúdo.
const selectVisita = {
  id: true,
  area: true,
  data: true,
  horario: true,
  cliente: true,
  quemRecebeu: true,
  telefone: true,
  status: true,
  observacao: true,
  documentoMime: true,
  documentoNome: true,
  fotos: { select: { id: true }, orderBy: { criadoEm: "asc" as const } },
  autor: true,
  criadoEm: true,
  atualizadoEm: true,
};

type RowVisita = {
  criadoEm: Date;
  atualizadoEm: Date;
  documentoMime: string | null;
  fotos: { id: string }[];
};

const paraContrato = (r: RowVisita) =>
  VisitaCarteira.parse({
    ...iso(r),
    fotos: r.fotos.map((f) => f.id),
    temDocumento: r.documentoMime != null,
  });

export async function criarVisita(autor: string, dados: VisitaCarteiraCreate): Promise<VisitaCarteira> {
  const row = await prisma.visitaCarteira.create({
    data: { ...dados, telefone: dados.telefone ?? null, observacao: dados.observacao ?? null, autor },
    select: selectVisita,
  });
  return paraContrato(row);
}

// `area` separa as duas portas do mesmo relatório (Ferramentas Comerciais × Técnicas);
// `excluidas` troca a lista dos vivos pela aba Excluídos.
export async function listarVisitas(
  usuario: SessaoUsuario,
  area: "comercial" | "tecnica",
  excluidas = false,
): Promise<VisitaCarteira[]> {
  const rows = await prisma.visitaCarteira.findMany({
    where: { ...escopo(usuario), area, ...(excluidas ? lapides : vivos) },
    orderBy: [{ data: "desc" }, { horario: "desc" }],
    select: selectVisita,
  });
  return rows.map(paraContrato);
}

// Edição (áudio do Mateus, 25/08/2026): vendedor edita as suas, gestor qualquer uma; a
// data e a área não entram (o contrato de update nem as aceita). Alheia → count 0 → 404.
export async function editarVisita(usuario: SessaoUsuario, id: string, dados: VisitaCarteiraUpdate): Promise<boolean> {
  const r = await prisma.visitaCarteira.updateMany({
    where: { id, ...escopo(usuario), ...vivos },
    data: { ...dados, telefone: dados.telefone ?? null, observacao: dados.observacao ?? null },
  });
  return r.count > 0;
}

/* ── Anexos da visita (áudio do Mateus, 25/08/2026): até 10 fotos e um documento ── */

export const MAX_FOTOS_VISITA = 10;

// Uma foto por chamada (cada requisição fica abaixo do teto de ~4,5 MB da Vercel). O
// escopo por autor vale para anexar: ninguém pendura foto na visita do colega.
export async function anexarFotoVisita(
  usuario: SessaoUsuario,
  visitaId: string,
  foto: { bytes: Uint8Array<ArrayBuffer>; mime: string },
): Promise<"ok" | "nao_encontrada" | "cheia"> {
  const visita = await prisma.visitaCarteira.findFirst({
    where: { id: visitaId, ...escopo(usuario) },
    select: { id: true, _count: { select: { fotos: true } } },
  });
  if (!visita) return "nao_encontrada";
  if (visita._count.fotos >= MAX_FOTOS_VISITA) return "cheia";
  await prisma.visitaFoto.create({ data: { visitaId, foto: foto.bytes, fotoMime: foto.mime } });
  return "ok";
}

export async function anexarDocumentoVisita(
  usuario: SessaoUsuario,
  visitaId: string,
  doc: { bytes: Uint8Array<ArrayBuffer>; mime: string; nome: string },
): Promise<boolean> {
  const r = await prisma.visitaCarteira.updateMany({
    where: { id: visitaId, ...escopo(usuario) },
    data: { documento: doc.bytes, documentoMime: doc.mime, documentoNome: doc.nome },
  });
  return r.count > 0;
}

// Leitura com o MESMO escopo da listagem — a rota não pode ser a fresta pela qual um
// vendedor abre o anexo do colega (mesmo desenho de pdfDoContrato).
export async function fotoDaVisita(
  usuario: SessaoUsuario,
  visitaId: string,
  fotoId: string,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const row = await prisma.visitaFoto.findFirst({
    where: { id: fotoId, visitaId, visita: escopo(usuario) },
    select: { foto: true, fotoMime: true },
  });
  return row ? { bytes: row.foto, mime: row.fotoMime } : null;
}

export async function documentoDaVisita(
  usuario: SessaoUsuario,
  visitaId: string,
): Promise<{ bytes: Uint8Array; mime: string; nome: string | null } | null> {
  const row = await prisma.visitaCarteira.findFirst({
    where: { id: visitaId, ...escopo(usuario) },
    select: { documento: true, documentoMime: true, documentoNome: true },
  });
  if (!row?.documento || !row.documentoMime) return null;
  return { bytes: row.documento, mime: row.documentoMime, nome: row.documentoNome };
}

// Tirar anexo errado (áudio do Mateus, 27/08/2026: "excluir a foto e o anexo que ela
// colocou para substituir por outro") — quem pode editar a visita mexe nos anexos dela.
export async function excluirFotoVisita(usuario: SessaoUsuario, visitaId: string, fotoId: string): Promise<boolean> {
  const r = await prisma.visitaFoto.deleteMany({ where: { id: fotoId, visitaId, visita: escopo(usuario) } });
  return r.count > 0;
}

export async function excluirDocumentoVisita(usuario: SessaoUsuario, visitaId: string): Promise<boolean> {
  const r = await prisma.visitaCarteira.updateMany({
    where: { id: visitaId, ...escopo(usuario), documentoMime: { not: null } },
    data: { documento: null, documentoMime: null, documentoNome: null },
  });
  return r.count > 0;
}

// Excluir vira lápide (a rota barra quem não é gestor); restaurar e excluir definitivo
// operam só sobre lápides. `updateMany`/`deleteMany` com o escopo no where: registro
// alheio não acha linha → false → 404 na rota (posse não se revela).
export async function excluirVisita(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.visitaCarteira.updateMany({ where: { id, ...escopo(usuario), ...vivos }, data: { excluidoEm: new Date() } });
  return r.count > 0;
}

export async function restaurarVisita(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.visitaCarteira.updateMany({ where: { id, ...escopo(usuario), ...lapides }, data: { excluidoEm: null } });
  return r.count > 0;
}

export async function excluirVisitaDefinitivo(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.visitaCarteira.deleteMany({ where: { id, ...escopo(usuario), ...lapides } });
  return r.count > 0;
}

/* ───────── Contratos e Comodatos ───────── */

// Os bytes do PDF entram aqui mas NUNCA saem na listagem — a coluna fica de fora do select
// e a UI deriva o link de /api/comodatos/<id>/pdf a partir de `temContrato`.
export async function criarContratoComodato(
  autor: string,
  dados: ContratoComodatoCreate,
  pdf: { bytes: Uint8Array<ArrayBuffer>; mime: string } | null,
): Promise<ContratoComodato> {
  const row = await prisma.contratoComodato.create({
    data: {
      ...dados,
      observacoes: dados.observacoes ?? null,
      autor,
      ...(pdf ? { contrato: pdf.bytes, contratoMime: pdf.mime } : {}),
    },
  });
  return ContratoComodato.parse({ ...iso(row), temContrato: row.contratoMime != null, contrato: undefined });
}

export async function listarContratosComodato(usuario: SessaoUsuario, excluidas = false): Promise<ContratoComodato[]> {
  const rows = await prisma.contratoComodato.findMany({
    where: { ...escopo(usuario), ...(excluidas ? lapides : vivos) },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      cliente: true,
      comodatos: true,
      observacoes: true,
      contratoMime: true,
      autor: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
  const anexos = await anexosDe("contrato", rows.map((r) => r.id));
  return rows.map((r) => ContratoComodato.parse({ ...iso(r), temContrato: r.contratoMime != null, anexos: anexos.get(r.id) ?? [] }));
}

// Edição (áudio do Mateus, 25/08/2026); o PDF não muda por aqui.
export async function editarContratoComodato(
  usuario: SessaoUsuario,
  id: string,
  dados: ContratoComodatoUpdate,
): Promise<boolean> {
  const r = await prisma.contratoComodato.updateMany({
    where: { id, ...escopo(usuario), ...vivos },
    data: { ...dados, observacoes: dados.observacoes ?? null },
  });
  return r.count > 0;
}

// Excluir vira lápide (rota barra quem não é gestor); restaurar/definitivo só sobre lápides.
export async function excluirContratoComodato(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.contratoComodato.updateMany({ where: { id, ...escopo(usuario), ...vivos }, data: { excluidoEm: new Date() } });
  return r.count > 0;
}

export async function restaurarContratoComodato(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.contratoComodato.updateMany({ where: { id, ...escopo(usuario), ...lapides }, data: { excluidoEm: null } });
  return r.count > 0;
}

export async function excluirContratoComodatoDefinitivo(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.contratoComodato.deleteMany({ where: { id, ...escopo(usuario), ...lapides } });
  return r.count > 0;
}

// PDF do contrato, com o MESMO escopo da listagem: o id é cuid não adivinhável, mas a rota
// não pode ser a fresta pela qual um vendedor abre o contrato do colega.
export async function pdfDoContrato(
  usuario: SessaoUsuario,
  id: string,
): Promise<{ bytes: Uint8Array; mime: string; cliente: string } | null> {
  const row = await prisma.contratoComodato.findFirst({
    where: { id, ...escopo(usuario) },
    select: { contrato: true, contratoMime: true, cliente: true },
  });
  if (!row?.contrato || !row.contratoMime) return null;
  return { bytes: row.contrato, mime: row.contratoMime, cliente: row.cliente };
}

/* ───────── Estoque de Comodatos ───────── */

export async function criarEstoqueComodato(autor: string, dados: EstoqueComodatoCreate): Promise<EstoqueComodato> {
  const row = await prisma.estoqueComodato.create({
    data: { ...dados, obs: dados.obs ?? null, autor },
  });
  return EstoqueComodato.parse(iso(row));
}

export async function listarEstoqueComodato(usuario: SessaoUsuario, excluidas = false): Promise<EstoqueComodato[]> {
  const rows = await prisma.estoqueComodato.findMany({
    where: { ...escopo(usuario), ...(excluidas ? lapides : vivos) },
    orderBy: { criadoEm: "desc" },
  });
  const anexos = await anexosDe("estoque", rows.map((r) => r.id));
  return rows.map((r) => EstoqueComodato.parse({ ...iso(r), anexos: anexos.get(r.id) ?? [] }));
}

// Edição (áudio do Mateus, 25/08/2026).
export async function editarEstoqueComodato(
  usuario: SessaoUsuario,
  id: string,
  dados: EstoqueComodatoUpdate,
): Promise<boolean> {
  const r = await prisma.estoqueComodato.updateMany({
    where: { id, ...escopo(usuario), ...vivos },
    data: { ...dados, obs: dados.obs ?? null },
  });
  return r.count > 0;
}

// Excluir vira lápide (rota barra quem não é gestor); restaurar/definitivo só sobre lápides.
export async function excluirEstoqueComodato(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.estoqueComodato.updateMany({ where: { id, ...escopo(usuario), ...vivos }, data: { excluidoEm: new Date() } });
  return r.count > 0;
}

export async function restaurarEstoqueComodato(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.estoqueComodato.updateMany({ where: { id, ...escopo(usuario), ...lapides }, data: { excluidoEm: null } });
  return r.count > 0;
}

export async function excluirEstoqueComodatoDefinitivo(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.estoqueComodato.deleteMany({ where: { id, ...escopo(usuario), ...lapides } });
  return r.count > 0;
}
