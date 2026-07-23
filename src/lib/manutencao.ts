// Faxina do dashboard — arquiva propostas de dias anteriores no fim do expediente.
//
// Regra: no fim do dia útil só as propostas geradas HOJE continuam no dashboard; tudo o
// que é de ontem para trás vira `arquivada`. Arquivar NÃO apaga — a linha continua no
// banco com o scope inteiro, só sai da listagem padrão (ver listarPropostas). Reverter é
// um PATCH de status.
//
// O corte é sempre a meia-noite de Brasília, não do servidor: a função roda na Vercel em
// UTC e um `new Date()` truncado lá arquivaria as propostas da própria tarde.
import { prisma } from "@/lib/db";

// Brasília é UTC-3 fixo desde 2019 (o horário de verão foi extinto pelo Decreto 9.772).
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000;

/**
 * Instante (em UTC) da meia-noite de Brasília do dia de `agora`.
 * Proposta criada ANTES desse instante é de um dia anterior → entra na faxina.
 */
export function inicioDoDiaBrasilia(agora: Date): Date {
  const emBrasilia = new Date(agora.getTime() - OFFSET_BRASILIA_MS);
  const meiaNoiteBrasilia = Date.UTC(
    emBrasilia.getUTCFullYear(),
    emBrasilia.getUTCMonth(),
    emBrasilia.getUTCDate(),
  );
  return new Date(meiaNoiteBrasilia + OFFSET_BRASILIA_MS);
}

export type ResultadoFaxina = { arquivadas: number; corte: string };

/**
 * Arquiva toda proposta criada antes da meia-noite de Brasília de hoje.
 * Idempotente: o que já está `arquivada` fica de fora, então rodar duas vezes no mesmo
 * dia arquiva 0 na segunda.
 */
export async function arquivarPropostasDeDiasAnteriores(agora = new Date()): Promise<ResultadoFaxina> {
  const corte = inicioDoDiaBrasilia(agora);
  const { count } = await prisma.proposta.updateMany({
    where: { criadoEm: { lt: corte }, status: { not: "arquivada" } },
    data: { status: "arquivada" },
  });
  return { arquivadas: count, corte: corte.toISOString() };
}
