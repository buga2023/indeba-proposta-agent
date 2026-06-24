import { z } from "zod";

/**
 * Gerador de posts para Instagram (com imagem por IA).
 *
 * Texto: 100% criativo via IA (procedência IA-TEXTO) — sem dado crítico do catálogo.
 * Imagem: gerada localmente por Stable Diffusion (A1111/Forge) a partir do
 * `imagemPrompt` (em inglês) que a IA escreve por post. Sem Ollama, cai num template
 * determinístico (degradação graciosa — constituição §5); sem SD, o card mostra o
 * prompt da imagem no lugar do render.
 */

export const TomPost = z.enum([
  "profissional",
  "descontraido",
  "inspirador",
  "humoristico",
  "educativo",
]);
export type TomPost = z.infer<typeof TomPost>;

// Entrada: o cliente descreve em linguagem natural; os campos de negócio dão contexto.
export const InstagramRequest = z.object({
  briefing: z.string().min(1).max(2000),
  nicho: z.string().max(120).nullable().default(null),
  produtoServico: z.string().max(200).nullable().default(null),
  publicoAlvo: z.string().max(200).nullable().default(null),
  tom: TomPost.default("profissional"),
  numPosts: z.number().int().min(1).max(1).default(1), // travado em 1 post — foco em qualidade máxima
});
export type InstagramRequest = z.infer<typeof InstagramRequest>;

export const PostInstagram = z.object({
  versao: z.number().int(),
  tema: z.string(), // ex.: "Autoridade", "Educativo", "Prova social", "Oferta", "Conexão"
  abertura: z.string(), // primeira linha (gancho antes do "ver mais")
  legenda: z.string(), // body copy + CTA, pronto para copiar
  hashtags: z.array(z.string()), // sem o "#"
  melhorHorario: z.string(), // dia + horário + justificativa rápida
  sugestaoCriativo: z.string(), // descrição do visual em PORTUGUÊS (mostrada ao usuário)
  imagemPrompt: z.string(), // prompt em INGLÊS para o Stable Diffusion (1:1) — uso técnico
});
export type PostInstagram = z.infer<typeof PostInstagram>;

export const InstagramResponse = z.object({
  posts: z.array(PostInstagram),
  notaEditorial: z.string(), // escolhas de linha visual e tom
});
export type InstagramResponse = z.infer<typeof InstagramResponse>;
