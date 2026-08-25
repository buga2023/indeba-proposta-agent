import { z } from "zod";

/**
 * Ferramentas Técnicas (áudio do Mateus, 21/08/2026): Registro de Visitas da Carteira,
 * Contratos e Comodatos (com PDF anexo) e Estoque de Comodatos.
 *
 * Procedência: dado operacional lançado pelo vendedor. O `autor` SEMPRE vem da sessão,
 * nunca do cliente. Todo vendedor escreve; cada um lê SÓ os próprios registros, o gestor
 * lê todos — o recorte fica em lib/ferramentas-tecnicas.ts, igual a Chamado/Proposta.
 */

export const StatusVisita = z.enum(["resolvido", "nao_resolvido"]);
export type StatusVisita = z.infer<typeof StatusVisita>;

// A foto do bloco lista o Relatório de Visitas de Rotina nas DUAS partes (comerciais e
// técnicas); `area` diz de qual tela o registro é — uma tabela, duas portas.
export const AreaVisita = z.enum(["comercial", "tecnica"]);
export type AreaVisita = z.infer<typeof AreaVisita>;

// Data e horário viajam como strings digitadas (sem fuso): o registro é a anotação do
// vendedor, não um instante de máquina.
export const VisitaCarteiraCreate = z.object({
  area: AreaVisita.default("tecnica"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD"),
  horario: z.string().regex(/^\d{2}:\d{2}$/, "horário no formato HH:MM"),
  cliente: z.string().min(2).max(200),
  quemRecebeu: z.string().min(2).max(200),
  telefone: z.string().max(30).nullable().optional(),
  status: StatusVisita.default("nao_resolvido"),
  observacao: z.string().max(4000).nullable().optional(),
});
export type VisitaCarteiraCreate = z.infer<typeof VisitaCarteiraCreate>;

export const VisitaCarteira = z.object({
  id: z.string(),
  area: AreaVisita,
  data: z.string(),
  horario: z.string(),
  cliente: z.string(),
  quemRecebeu: z.string(),
  telefone: z.string().nullable(),
  status: StatusVisita,
  observacao: z.string().nullable(),
  autor: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type VisitaCarteira = z.infer<typeof VisitaCarteira>;

// O PDF não passa por aqui: vai em multipart, validado na rota (mesmo padrão da ficha
// técnica de produto — MIME application/pdf, teto de 4 MB da função Vercel).
export const ContratoComodatoCreate = z.object({
  cliente: z.string().min(2).max(200),
  comodatos: z.string().min(1).max(8000),
  observacoes: z.string().max(4000).nullable().optional(),
});
export type ContratoComodatoCreate = z.infer<typeof ContratoComodatoCreate>;

// `temContrato` derivado no servidor: a listagem não trafega os bytes — o PDF é servido
// por /api/comodatos/<id>/pdf quando alguém clica.
export const ContratoComodato = z.object({
  id: z.string(),
  cliente: z.string(),
  comodatos: z.string(),
  observacoes: z.string().nullable(),
  temContrato: z.boolean(),
  autor: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type ContratoComodato = z.infer<typeof ContratoComodato>;

export const EstoqueComodatoCreate = z.object({
  codigo: z.string().min(1).max(60),
  peca: z.string().min(1).max(200),
  quantidade: z.number().int().min(0).max(1_000_000),
  obs: z.string().max(4000).nullable().optional(),
});
export type EstoqueComodatoCreate = z.infer<typeof EstoqueComodatoCreate>;

export const EstoqueComodato = z.object({
  id: z.string(),
  codigo: z.string(),
  peca: z.string(),
  quantidade: z.number().int(),
  obs: z.string().nullable(),
  autor: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type EstoqueComodato = z.infer<typeof EstoqueComodato>;
