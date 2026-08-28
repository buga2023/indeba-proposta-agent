import { prisma } from "@/lib/db";
import { AnexoInfo, type TipoRegistroAnexo, type CategoriaAnexo } from "@/lib/contracts";
import type { SessaoUsuario } from "@/lib/auth";

/**
 * Anexos das ferramentas (áudio do Mateus, 27/08/2026): fotos e documentos em qualquer
 * registro de prospecção, solicitação, contrato/comodato ou estoque. Uma tabela só, sem
 * FK — a posse é verificada aqui, consultando a tabela do registro dono com o MESMO
 * recorte por autor das listagens (vendedor mexe só nos seus, o gestor em todos).
 */

export const MAX_ANEXOS_POR_CATEGORIA = 10;

function escopo(usuario: SessaoUsuario) {
  return usuario.papel === "admin" ? {} : { autor: usuario.email };
}

// O registro dono precisa existir, estar vivo (sem lápide) e ser acessível ao usuário —
// senão o anexo seria a fresta para mexer no registro do colega.
async function registroAcessivel(usuario: SessaoUsuario, tipo: TipoRegistroAnexo, registroId: string): Promise<boolean> {
  const where = { id: registroId, ...escopo(usuario), excluidoEm: null };
  switch (tipo) {
    case "prospeccao":
      return (await prisma.relatorioProspeccao.findFirst({ where, select: { id: true } })) != null;
    case "solicitacao":
      return (await prisma.solicitacaoComercial.findFirst({ where, select: { id: true } })) != null;
    case "contrato":
      return (await prisma.contratoComodato.findFirst({ where, select: { id: true } })) != null;
    case "estoque":
      return (await prisma.estoqueComodato.findFirst({ where, select: { id: true } })) != null;
  }
}

export async function anexar(
  usuario: SessaoUsuario,
  tipo: TipoRegistroAnexo,
  registroId: string,
  categoria: CategoriaAnexo,
  arquivo: { bytes: Uint8Array<ArrayBuffer>; mime: string; nome: string },
): Promise<"ok" | "nao_encontrado" | "cheio"> {
  if (!(await registroAcessivel(usuario, tipo, registroId))) return "nao_encontrado";
  const quantos = await prisma.anexo.count({ where: { registroTipo: tipo, registroId, categoria } });
  if (quantos >= MAX_ANEXOS_POR_CATEGORIA) return "cheio";
  await prisma.anexo.create({
    data: { registroTipo: tipo, registroId, categoria, nome: arquivo.nome, mime: arquivo.mime, bytes: arquivo.bytes },
  });
  return "ok";
}

// Anexos de VÁRIOS registros numa consulta só (a listagem chama com todos os ids) —
// só id/categoria/nome, os bytes nunca trafegam aqui.
export async function anexosDe(tipo: TipoRegistroAnexo, registroIds: string[]): Promise<Map<string, AnexoInfo[]>> {
  const mapa = new Map<string, AnexoInfo[]>();
  if (registroIds.length === 0) return mapa;
  const rows = await prisma.anexo.findMany({
    where: { registroTipo: tipo, registroId: { in: registroIds } },
    select: { id: true, registroId: true, categoria: true, nome: true },
    orderBy: { criadoEm: "asc" },
  });
  for (const r of rows) {
    const lista = mapa.get(r.registroId) ?? [];
    lista.push(AnexoInfo.parse({ id: r.id, categoria: r.categoria, nome: r.nome }));
    mapa.set(r.registroId, lista);
  }
  return mapa;
}

// Abre UM anexo, com o mesmo escopo da listagem (mesmo desenho de fotoDaVisita).
export async function abrirAnexo(
  usuario: SessaoUsuario,
  id: string,
): Promise<{ bytes: Uint8Array; mime: string; nome: string | null } | null> {
  const row = await prisma.anexo.findUnique({ where: { id } });
  if (!row) return null;
  const tipo = row.registroTipo as TipoRegistroAnexo;
  // Para ABRIR, registro com lápide ainda conta (a aba Excluídos mostra o registro): o
  // escopo por autor continua obrigatório, só a exigência de "vivo" cai.
  const where = { id: row.registroId, ...escopo(usuario) };
  const dono =
    tipo === "prospeccao"
      ? await prisma.relatorioProspeccao.findFirst({ where, select: { id: true } })
      : tipo === "solicitacao"
        ? await prisma.solicitacaoComercial.findFirst({ where, select: { id: true } })
        : tipo === "contrato"
          ? await prisma.contratoComodato.findFirst({ where, select: { id: true } })
          : await prisma.estoqueComodato.findFirst({ where, select: { id: true } });
  if (!dono) return null;
  return { bytes: row.bytes, mime: row.mime, nome: row.nome };
}

// Excluir anexo: quem pode editar o registro pode trocar os anexos dele (áudio do Mateus,
// 27/08/2026: "a pessoa pode anexar errado… tem que dar a possibilidade de substituir").
export async function excluirAnexo(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const row = await prisma.anexo.findUnique({ where: { id }, select: { registroTipo: true, registroId: true } });
  if (!row) return false;
  if (!(await registroAcessivel(usuario, row.registroTipo as TipoRegistroAnexo, row.registroId))) return false;
  await prisma.anexo.delete({ where: { id } });
  return true;
}
