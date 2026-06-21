import { z } from "zod";

// Entrada do vendedor: o que ele vende e que tipo de cliente quer prospectar.
// Tudo texto livre (vira prompt da IA) — cap de tamanho evita abuso/DoS.
export const ProspeccaoRequest = z.object({
  nicho: z.string().min(1).max(300),
  tipoCliente: z.string().min(1).max(300),
  servicoOferecido: z.string().min(1).max(500),
  localizacao: z.string().max(120).nullable().default(null),
});
export type ProspeccaoRequest = z.infer<typeof ProspeccaoRequest>;

// "confirmado" = dado veio da busca web; "estimado" = a IA inferiu (pista a confirmar).
// Diferente da proposta, prospecção é por natureza IA-gerada — por isso a procedência
// fica explícita em cada prospect (constituição §7).
export const Confiabilidade = z.enum(["confirmado", "estimado"]);

export const Prospect = z.object({
  nome: z.string(),
  setor: z.string(),
  decisor: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  linkedin: z.string().nullable().default(null),
  instagram: z.string().nullable().default(null),
  site: z.string().nullable().default(null),
  telefone: z.string().nullable().default(null),
  comoAjudar: z.string(),
  confiabilidade: Confiabilidade,
});
export type Prospect = z.infer<typeof Prospect>;

export const Abordagem = z.object({
  titulo: z.string(),
  canal: z.string(),
  tom: z.string(),
  roteiro: z.string(),
  dica: z.string(),
});
export type Abordagem = z.infer<typeof Abordagem>;

// Saída crua da IA (sem `total` — esse é calculado no backend, nunca pelo modelo).
export const ProspeccaoIA = z.object({
  prospects: z.array(Prospect),
  abordagens: z.array(Abordagem),
});
export type ProspeccaoIA = z.infer<typeof ProspeccaoIA>;

export const ProspeccaoResponse = ProspeccaoIA.extend({
  total: z.number().int().nonnegative(),
});
export type ProspeccaoResponse = z.infer<typeof ProspeccaoResponse>;
