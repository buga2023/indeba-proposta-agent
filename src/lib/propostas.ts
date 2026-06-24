// Persistência da proposta comercial (store de trabalho). Guarda o PropostaScope
// canônico + status MUTÁVEL, espelhando o contrato Zod (src/lib/contracts/proposta.ts).
// Permite reabrir e gerar contrato de uma proposta que já existe. O log append-only
// (lib/log.ts) segue como auditoria imutável de cada PDF emitido (constituição §8).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PropostaResumo,
  PropostaRegistro,
  type PropostaScope,
  type StatusProposta,
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

function baseResumo(row: Row) {
  const itens = (row.scope as { itens?: unknown[] } | null)?.itens;
  return {
    id: row.id,
    status: row.status,
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

// Valida via Zod ao mapear — garante que o que sai do banco respeita o contrato.
const mapearResumo = (row: Row): PropostaResumo => PropostaResumo.parse(baseResumo(row));
const mapearRegistro = (row: Row): PropostaRegistro =>
  PropostaRegistro.parse({ ...baseResumo(row), scope: row.scope });

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
  return mapearRegistro(row);
}

export async function listarPropostas(limite = 200): Promise<PropostaResumo[]> {
  const rows = await prisma.proposta.findMany({ orderBy: { atualizadoEm: "desc" }, take: limite });
  return rows.map(mapearResumo);
}

export async function obterProposta(id: string): Promise<PropostaRegistro | null> {
  const row = await prisma.proposta.findUnique({ where: { id } });
  return row ? mapearRegistro(row) : null;
}

export async function atualizarStatusProposta(id: string, status: StatusProposta): Promise<PropostaRegistro> {
  const row = await prisma.proposta.update({ where: { id }, data: { status } });
  return mapearRegistro(row);
}
