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

// "confirmado" = tem ≥1 contato real minerado de uma fonte web; "estimado" = a IA
// só sugeriu a empresa, sem contato comprovado. DERIVADO no backend, nunca pelo
// modelo (constituição §2: dado crítico nunca vem do modelo).
export const Confiabilidade = z.enum(["confirmado", "estimado"]);

// Links de redes sociais — preenchidos pelo minerador a partir das páginas, não pela IA.
export const RedesSociais = z.object({
  linkedin: z.string().nullable().default(null),
  instagram: z.string().nullable().default(null),
  facebook: z.string().nullable().default(null),
  whatsapp: z.string().nullable().default(null),
});
export type RedesSociais = z.infer<typeof RedesSociais>;

// Saída CRUA da IA por prospect: a IA só seleciona a empresa e ESCREVE texto.
// NÃO produz contatos nem confiabilidade — esses nascem da mineração no backend.
export const ProspectIA = z.object({
  nome: z.string(),
  setor: z.string(),
  site: z.string().nullable().default(null),
  comoAjudar: z.string(),
  mensagemPronta: z.string(),
});
export type ProspectIA = z.infer<typeof ProspectIA>;

// Prospect final = saída da IA + contatos minerados + procedência (carimbados no backend).
export const Prospect = ProspectIA.extend({
  emails: z.array(z.string()).default([]),
  telefones: z.array(z.string()).default([]),
  redes: RedesSociais,
  confiabilidade: Confiabilidade,
  fonte: z.string().nullable().default(null), // URL que embasou os contatos
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

// Saída crua da IA (prospects sem contato + abordagens).
export const ProspeccaoIA = z.object({
  prospects: z.array(ProspectIA),
  abordagens: z.array(Abordagem),
});
export type ProspeccaoIA = z.infer<typeof ProspeccaoIA>;

// Resposta final: prospects enriquecidos + total (calculado no backend, nunca pela IA).
export const ProspeccaoResponse = z.object({
  prospects: z.array(Prospect),
  abordagens: z.array(Abordagem),
  total: z.number().int().nonnegative(),
});
export type ProspeccaoResponse = z.infer<typeof ProspeccaoResponse>;
