import { prisma } from "@/lib/db";
import {
  RelatorioProspeccao,
  type RelatorioProspeccaoCreate,
  type RelatorioProspeccaoUpdate,
  SolicitacaoComercial,
  type SolicitacaoComercialCreate,
  type SolicitacaoComercialUpdate,
} from "@/lib/contracts";
import type { SessaoUsuario } from "@/lib/auth";
import { anexosDe } from "@/lib/anexos";

// Mesmo recorte das Ferramentas Técnicas (áudio do Mateus, 21/08/2026): todo vendedor
// escreve; cada um lê só os próprios registros, o gestor lê todos.
function escopo(usuario: SessaoUsuario) {
  return usuario.papel === "admin" ? {} : { autor: usuario.email };
}

// Lápide da aba Excluídos (áudio do Mateus, 25/08/2026) — mesmo desenho de
// lib/ferramentas-tecnicas.ts: excluir marca `excluidoEm`, a aba Excluídos restaura
// ou apaga definitivamente.
const vivos = { excluidoEm: null } as const;
const lapides = { excluidoEm: { not: null } } as const;

const iso = <T extends { criadoEm: Date; atualizadoEm: Date }>(row: T) => ({
  ...row,
  criadoEm: row.criadoEm.toISOString(),
  atualizadoEm: row.atualizadoEm.toISOString(),
});

/* ───────── Relatório de Novas Prospecções ───────── */

export async function criarRelatorioProspeccao(autor: string, dados: RelatorioProspeccaoCreate): Promise<RelatorioProspeccao> {
  const row = await prisma.relatorioProspeccao.create({
    data: {
      ...dados,
      horario: dados.horario ?? null,
      contato: dados.contato ?? null,
      telefone: dados.telefone ?? null,
      observacao: dados.observacao ?? null,
      autor,
    },
  });
  return RelatorioProspeccao.parse(iso(row));
}

export async function listarRelatoriosProspeccao(usuario: SessaoUsuario, excluidas = false): Promise<RelatorioProspeccao[]> {
  const rows = await prisma.relatorioProspeccao.findMany({
    where: { ...escopo(usuario), ...(excluidas ? lapides : vivos) },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
  });
  const anexos = await anexosDe("prospeccao", rows.map((r) => r.id));
  return rows.map((r) => RelatorioProspeccao.parse({ ...iso(r), anexos: anexos.get(r.id) ?? [] }));
}

// Edição (áudio do Mateus, 25/08/2026): o vendedor ajusta os próprios registros (ex.: o
// texto dos próximos passos), o gestor edita qualquer um. A DATA não entra no update —
// fica a da visita registrada. Alheio → count 0 → 404 na rota.
export async function editarRelatorioProspeccao(
  usuario: SessaoUsuario,
  id: string,
  dados: RelatorioProspeccaoUpdate,
): Promise<boolean> {
  const r = await prisma.relatorioProspeccao.updateMany({
    where: { id, ...escopo(usuario), ...vivos },
    data: {
      ...dados,
      telefone: dados.telefone ?? null,
      observacao: dados.observacao ?? null,
    },
  });
  return r.count > 0;
}

// Excluir é só do gestor (áudio do Mateus, 25/08/2026: o usuário só edita) — a rota barra
// o papel antes de chegar aqui; o escopo continua por segurança em profundidade. Vira
// lápide; restaurar e excluir definitivo operam só sobre lápides.
export async function excluirRelatorioProspeccao(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.relatorioProspeccao.updateMany({ where: { id, ...escopo(usuario), ...vivos }, data: { excluidoEm: new Date() } });
  return r.count > 0;
}

export async function restaurarRelatorioProspeccao(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.relatorioProspeccao.updateMany({ where: { id, ...escopo(usuario), ...lapides }, data: { excluidoEm: null } });
  return r.count > 0;
}

export async function excluirRelatorioProspeccaoDefinitivo(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.relatorioProspeccao.deleteMany({ where: { id, ...escopo(usuario), ...lapides } });
  return r.count > 0;
}

/* ───────── Solicitações Comerciais ───────── */

export async function criarSolicitacaoComercial(autor: string, dados: SolicitacaoComercialCreate): Promise<SolicitacaoComercial> {
  const row = await prisma.solicitacaoComercial.create({
    data: { ...dados, observacao: dados.observacao ?? null, autor },
  });
  return SolicitacaoComercial.parse(iso(row));
}

export async function listarSolicitacoesComerciais(usuario: SessaoUsuario, excluidas = false): Promise<SolicitacaoComercial[]> {
  const rows = await prisma.solicitacaoComercial.findMany({
    where: { ...escopo(usuario), ...(excluidas ? lapides : vivos) },
    orderBy: { criadoEm: "desc" },
  });
  const anexos = await anexosDe("solicitacao", rows.map((r) => r.id));
  return rows.map((r) => SolicitacaoComercial.parse({ ...iso(r), anexos: anexos.get(r.id) ?? [] }));
}

// Edição com o MESMO escopo da listagem (áudio do Mateus, 25/08/2026: "editar para a
// parte deles"): o vendedor ajusta as suas — status (a amostra chegou), tipo, cliente,
// observação —, o gestor qualquer uma. Alheia → false → 404 na rota.
export async function editarSolicitacaoComercial(
  usuario: SessaoUsuario,
  id: string,
  dados: SolicitacaoComercialUpdate,
): Promise<boolean> {
  const r = await prisma.solicitacaoComercial.updateMany({ where: { id, ...escopo(usuario), ...vivos }, data: dados });
  return r.count > 0;
}

// Excluir é só do gestor (a rota barra o papel); vira lápide — restaurar e excluir
// definitivo operam só sobre lápides.
export async function excluirSolicitacaoComercial(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.solicitacaoComercial.updateMany({ where: { id, ...escopo(usuario), ...vivos }, data: { excluidoEm: new Date() } });
  return r.count > 0;
}

export async function restaurarSolicitacaoComercial(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.solicitacaoComercial.updateMany({ where: { id, ...escopo(usuario), ...lapides }, data: { excluidoEm: null } });
  return r.count > 0;
}

export async function excluirSolicitacaoComercialDefinitivo(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.solicitacaoComercial.deleteMany({ where: { id, ...escopo(usuario), ...lapides } });
  return r.count > 0;
}
