import { prisma } from "@/lib/db";
import {
  RelatorioProspeccao,
  type RelatorioProspeccaoCreate,
  SolicitacaoComercial,
  type SolicitacaoComercialCreate,
  type StatusSolicitacaoComercial,
} from "@/lib/contracts";
import type { SessaoUsuario } from "@/lib/auth";

// Mesmo recorte das Ferramentas Técnicas (áudio do Mateus, 21/08/2026): todo vendedor
// escreve; cada um lê só os próprios registros, o gestor lê todos.
function escopo(usuario: SessaoUsuario) {
  return usuario.papel === "admin" ? {} : { autor: usuario.email };
}

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
      contato: dados.contato ?? null,
      telefone: dados.telefone ?? null,
      observacao: dados.observacao ?? null,
      autor,
    },
  });
  return RelatorioProspeccao.parse(iso(row));
}

export async function listarRelatoriosProspeccao(usuario: SessaoUsuario): Promise<RelatorioProspeccao[]> {
  const rows = await prisma.relatorioProspeccao.findMany({ where: escopo(usuario), orderBy: [{ data: "desc" }, { criadoEm: "desc" }] });
  return rows.map((r) => RelatorioProspeccao.parse(iso(r)));
}

export async function excluirRelatorioProspeccao(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.relatorioProspeccao.deleteMany({ where: { id, ...escopo(usuario) } });
  return r.count > 0;
}

/* ───────── Solicitações Comerciais ───────── */

export async function criarSolicitacaoComercial(autor: string, dados: SolicitacaoComercialCreate): Promise<SolicitacaoComercial> {
  const row = await prisma.solicitacaoComercial.create({
    data: { ...dados, observacao: dados.observacao ?? null, autor },
  });
  return SolicitacaoComercial.parse(iso(row));
}

export async function listarSolicitacoesComerciais(usuario: SessaoUsuario): Promise<SolicitacaoComercial[]> {
  const rows = await prisma.solicitacaoComercial.findMany({ where: escopo(usuario), orderBy: { criadoEm: "desc" } });
  return rows.map((r) => SolicitacaoComercial.parse(iso(r)));
}

// Pendente ⇄ atendida, com o MESMO escopo da listagem: o vendedor marca as suas
// (ex.: a amostra chegou), o gestor marca qualquer uma. Alheia → false → 404 na rota.
export async function atualizarStatusSolicitacao(
  usuario: SessaoUsuario,
  id: string,
  status: StatusSolicitacaoComercial,
): Promise<boolean> {
  const r = await prisma.solicitacaoComercial.updateMany({ where: { id, ...escopo(usuario) }, data: { status } });
  return r.count > 0;
}

export async function excluirSolicitacaoComercial(usuario: SessaoUsuario, id: string): Promise<boolean> {
  const r = await prisma.solicitacaoComercial.deleteMany({ where: { id, ...escopo(usuario) } });
  return r.count > 0;
}
