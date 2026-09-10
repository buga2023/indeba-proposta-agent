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
import { nomeDeAutor, nomesDeAutores } from "@/lib/autores";
import { dataBr, dataHoraBr, type Ficha } from "@/lib/pdf/registro";

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
  // Nome de quem lançou (áudio do Mateus, 31/08/2026) — uma consulta para a lista toda.
  const nomes = await nomesDeAutores(rows.map((r) => r.autor));
  return rows.map((r) =>
    RelatorioProspeccao.parse({ ...iso(r), anexos: anexos.get(r.id) ?? [], autorNome: nomes.get(r.autor) ?? null }),
  );
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
  const nomes = await nomesDeAutores(rows.map((r) => r.autor));
  return rows.map((r) =>
    SolicitacaoComercial.parse({ ...iso(r), anexos: anexos.get(r.id) ?? [], autorNome: nomes.get(r.autor) ?? null }),
  );
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

/* ───────── Fichas em PDF (áudio do Mateus, 10/09/2026) ───────── */

// Rótulos dos tipos de solicitação. Espelham TIPOS_SOLICITACAO da tela
// (components/ferramentas-comerciais-screen.tsx): o PDF que vai para o cliente não pode
// dizer "analise_agua_tecidos".
const ROTULO_TIPO: Record<string, string> = {
  analise_agua_tecidos: "Análise de água e/ou tecidos",
  analise_produtos_quimicos: "Análise dos produtos químicos",
  visita_setor_tecnico: "Visita do setor técnico",
  amostra_demonstracao: "Amostra para demonstração",
  outras: "Outras solicitações",
};

// Mesmo recorte por autor da listagem — o id é cuid não adivinhável, mas a rota do PDF não
// pode virar a fresta por onde um vendedor lê o registro do colega.
export async function fichaDaProspeccao(usuario: SessaoUsuario, id: string): Promise<Ficha | null> {
  const row = await prisma.relatorioProspeccao.findFirst({
    where: { id, ...escopo(usuario) },
    select: { data: true, horario: true, empresa: true, contato: true, telefone: true, observacao: true, autor: true, criadoEm: true },
  });
  if (!row) return null;
  return {
    titulo: "Relatório de Nova Prospecção",
    cliente: row.empresa,
    campos: [
      { rotulo: "Data", valor: dataBr(row.data) },
      { rotulo: "Horário", valor: row.horario ?? "" },
      { rotulo: "Contato", valor: row.contato ?? "" },
      { rotulo: "Telefone", valor: row.telefone ?? "" },
    ],
    blocos: [{ rotulo: "Anotações da prospecção", texto: row.observacao ?? "" }],
    fotos: [],
    registradoPor: (await nomeDeAutor(row.autor)) ?? row.autor,
    registradoEm: dataHoraBr(row.criadoEm),
  };
}

export async function fichaDaSolicitacao(usuario: SessaoUsuario, id: string): Promise<Ficha | null> {
  const row = await prisma.solicitacaoComercial.findFirst({
    where: { id, ...escopo(usuario) },
    select: { tipo: true, cliente: true, observacao: true, status: true, autor: true, criadoEm: true },
  });
  if (!row) return null;
  const atendida = row.status === "atendida";
  return {
    titulo: "Solicitação Comercial",
    cliente: row.cliente,
    selo: { texto: atendida ? "Atendida" : "Pendente", ok: atendida },
    campos: [{ rotulo: "Tipo de solicitação", valor: ROTULO_TIPO[row.tipo] ?? row.tipo }],
    blocos: [{ rotulo: "Observações", texto: row.observacao ?? "" }],
    fotos: [],
    registradoPor: (await nomeDeAutor(row.autor)) ?? row.autor,
    registradoEm: dataHoraBr(row.criadoEm),
  };
}
