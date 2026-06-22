import { z } from "zod";

/**
 * Gerador de posts para Instagram.
 *
 * Diferente do fluxo de proposta, aqui NÃO há dado crítico do catálogo: o conteúdo
 * é 100% texto criativo (procedência IA-TEXTO). A IA escreve; quando o Ollama está
 * fora, cai num template determinístico (degradação graciosa — constituição §5).
 */

export const TomPost = z.enum([
  "profissional",
  "descontraido",
  "inspirador",
  "humoristico",
  "educativo",
]);
export type TomPost = z.infer<typeof TomPost>;

// Entrada: o cliente descreve o post em linguagem natural; o resto é ajuste fino.
export const InstagramRequest = z.object({
  briefing: z.string().min(1).max(2000),
  nicho: z.string().max(120).nullable().default(null),
  tom: TomPost.default("profissional"),
  numVersoes: z.number().int().min(1).max(3).default(1),
});
export type InstagramRequest = z.infer<typeof InstagramRequest>;

export const PostInstagram = z.object({
  versao: z.number().int(),
  legenda: z.string(), // legenda completa, pronta para copiar
  abertura: z.string(), // primeira linha (gancho antes do "ver mais")
  hashtags: z.array(z.string()), // sem o "#"
  sugestaoCriativo: z.string(),
  melhorHorario: z.string(),
});
export type PostInstagram = z.infer<typeof PostInstagram>;

export const InstagramResponse = z.object({
  posts: z.array(PostInstagram),
  notaEditorial: z.string(), // explicação das escolhas do agente
});
export type InstagramResponse = z.infer<typeof InstagramResponse>;
