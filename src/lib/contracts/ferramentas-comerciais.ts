import { z } from "zod";
import { AnexoInfo } from "./anexos";

/**
 * Ferramentas Comerciais (foto do bloco do Mateus, 21/08/2026 — a foto tem autoridade
 * sobre o áudio): Relatório de Novas Prospecções, Relatório de Visitas de Rotina (mora
 * em ferramentas-tecnicas.ts com area="comercial") e Solicitações Comerciais.
 *
 * Procedência: dado operacional lançado pelo vendedor; `autor` SEMPRE da sessão. Todo
 * vendedor escreve; cada um lê só os próprios registros, o gestor lê todos.
 */

// Registro manual de prospecção feita pelo vendedor — diferente do módulo Prospecção,
// que garimpa empresas por IA. Horário além da data (áudio do Mateus, 25/08/2026), e
// "com quem falou" OBRIGATÓRIO (áudio de 25/08: sem asterisco não registra).
export const RelatorioProspeccaoCreate = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD"),
  horario: z.string().regex(/^\d{2}:\d{2}$/, "horário no formato HH:MM"),
  empresa: z.string().min(2).max(200),
  contato: z.string().min(2, "informe com quem falou").max(200),
  telefone: z.string().max(30).nullable().optional(),
  observacao: z.string().max(4000).nullable().optional(),
});
export type RelatorioProspeccaoCreate = z.infer<typeof RelatorioProspeccaoCreate>;

// Edição (áudio do Mateus, 25/08/2026): usuário e gestor editam, mas a DATA não muda —
// fica a da visita registrada; visita nova é registro novo. Por isso `data` não entra.
export const RelatorioProspeccaoUpdate = RelatorioProspeccaoCreate.omit({ data: true });
export type RelatorioProspeccaoUpdate = z.infer<typeof RelatorioProspeccaoUpdate>;

export const RelatorioProspeccao = z.object({
  id: z.string(),
  data: z.string(),
  horario: z.string().nullable(),
  empresa: z.string(),
  contato: z.string().nullable(),
  telefone: z.string().nullable(),
  observacao: z.string().nullable(),
  // Anexos (áudio do Mateus, 27/08/2026): foto da fachada, cartão de quem foi visitado…
  anexos: z.array(AnexoInfo).default([]),
  // Nome de quem lançou, resolvido na leitura (áudio do Mateus, 31/08/2026: a tela
  // mostra o NOME, não o e-mail). Null quando a conta não está mais no cadastro.
  autorNome: z.string().nullable().default(null),
  autor: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type RelatorioProspeccao = z.infer<typeof RelatorioProspeccao>;

// Os três primeiros vêm da foto do bloco: análise de água e/ou tecidos, visita do setor
// técnico, e solicitações de amostra para demonstrações. Análise dos produtos químicos e
// "outras solicitações" entraram no áudio do Mateus de 02/09/2026 ("tá faltando isso
// aqui: análise de água e tecidos, análise dos produtos químicos e outras solicitações").
export const TipoSolicitacaoComercial = z.enum([
  "analise_agua_tecidos",
  "analise_produtos_quimicos",
  "visita_setor_tecnico",
  "amostra_demonstracao",
  "outras",
]);
export type TipoSolicitacaoComercial = z.infer<typeof TipoSolicitacaoComercial>;

export const StatusSolicitacaoComercial = z.enum(["pendente", "atendida"]);
export type StatusSolicitacaoComercial = z.infer<typeof StatusSolicitacaoComercial>;

export const SolicitacaoComercialCreate = z.object({
  tipo: TipoSolicitacaoComercial,
  cliente: z.string().min(2).max(200),
  observacao: z.string().max(4000).nullable().optional(),
});
export type SolicitacaoComercialCreate = z.infer<typeof SolicitacaoComercialCreate>;

// Edição (áudio do Mateus, 25/08/2026: "editar para a parte deles"): além do andamento
// (pendente → atendida), o autor ajusta tipo, cliente e observação. Tudo opcional — o
// PATCH manda só o que mudou.
export const SolicitacaoComercialUpdate = z.object({
  status: StatusSolicitacaoComercial.optional(),
  tipo: TipoSolicitacaoComercial.optional(),
  cliente: z.string().min(2).max(200).optional(),
  observacao: z.string().max(4000).nullable().optional(),
});
export type SolicitacaoComercialUpdate = z.infer<typeof SolicitacaoComercialUpdate>;

export const SolicitacaoComercial = z.object({
  id: z.string(),
  tipo: TipoSolicitacaoComercial,
  cliente: z.string(),
  observacao: z.string().nullable(),
  // Anexos (áudio do Mateus, 27/08/2026): mesma opção de foto e documento das visitas.
  anexos: z.array(AnexoInfo).default([]),
  status: StatusSolicitacaoComercial,
  // Nome de quem lançou, resolvido na leitura (áudio do Mateus, 31/08/2026: a tela
  // mostra o NOME, não o e-mail). Null quando a conta não está mais no cadastro.
  autorNome: z.string().nullable().default(null),
  autor: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type SolicitacaoComercial = z.infer<typeof SolicitacaoComercial>;
