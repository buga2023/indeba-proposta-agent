import { z } from "zod";

/**
 * Chamados de suporte interno: o colaborador abre um chamado (bug, dúvida, sugestão…),
 * o gestor (papel `admin`) vê todos, muda o status e responde. Persistido no Postgres.
 *
 * Procedência: dado operacional (não vem do catálogo). O `autor` SEMPRE vem da sessão,
 * nunca do cliente (não dá pra abrir chamado no nome de outro). O gestor é o único que
 * altera status/resposta — autorização no servidor.
 */

export const CategoriaChamado = z.enum(["bug", "duvida", "sugestao", "infra", "outro"]);
export type CategoriaChamado = z.infer<typeof CategoriaChamado>;

export const PrioridadeChamado = z.enum(["baixa", "media", "alta"]);
export type PrioridadeChamado = z.infer<typeof PrioridadeChamado>;

export const StatusChamado = z.enum(["aberto", "em_andamento", "resolvido"]);
export type StatusChamado = z.infer<typeof StatusChamado>;

// Entrada do colaborador. O `autor` é injetado pelo servidor a partir da sessão.
export const ChamadoCreate = z.object({
  titulo: z.string().min(3).max(140),
  descricao: z.string().min(5).max(4000),
  categoria: CategoriaChamado.default("outro"),
  prioridade: PrioridadeChamado.default("media"),
});
export type ChamadoCreate = z.infer<typeof ChamadoCreate>;

// Atualização pelo gestor (só status e/ou resposta).
export const ChamadoUpdate = z
  .object({
    status: StatusChamado.optional(),
    respostaGestor: z.string().max(4000).nullable().optional(),
  })
  .refine((u) => u.status !== undefined || u.respostaGestor !== undefined, {
    message: "nada para atualizar",
  });
export type ChamadoUpdate = z.infer<typeof ChamadoUpdate>;

// Transporte (datas em ISO string). Espelha o modelo Prisma `Chamado`.
export const Chamado = z.object({
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  categoria: CategoriaChamado,
  prioridade: PrioridadeChamado,
  status: StatusChamado,
  autor: z.string(),
  respostaGestor: z.string().nullable(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type Chamado = z.infer<typeof Chamado>;
