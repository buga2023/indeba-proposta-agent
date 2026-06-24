import { z } from "zod";

/**
 * Referências de estilo para o gerador de posts (Instagram).
 *
 * O vendedor coloca posts de referência (imagem + legenda) numa pasta no Google Drive;
 * o n8n lê a pasta e envia para `/api/referencias/sync`. Um modelo de VISÃO local
 * (Ollama, ex.: qwen2.5vl) descreve o ESTILO de cada imagem; um modelo de texto destila
 * tudo num único descritor visual (fragmento em inglês para o Flux). As legendas viram
 * exemplos few-shot do tom.
 *
 * Procedência: IA-TEXTO. Nenhum dado crítico do catálogo passa por aqui — o estilo é
 * "tempero" (constituição §1). O perfil é derivado UMA vez e salvo em
 * `data/referencias/perfil-estilo.json`; a geração apenas LÊ o perfil (determinístico).
 */

// Um item de referência vindo do n8n/Drive: imagem (base64, sem prefixo data:) e/ou legenda.
export const ReferenciaItem = z
  .object({
    nomeArquivo: z.string().min(1).max(260),
    imagemBase64: z.string().max(15_000_000).nullable().default(null), // ~11MB de imagem
    legenda: z.string().max(4_000).nullable().default(null),
  })
  .refine((i) => i.imagemBase64 || i.legenda, {
    message: "cada referência precisa de imagem ou legenda",
  });
export type ReferenciaItem = z.infer<typeof ReferenciaItem>;

export const SyncReferenciasRequest = z.object({
  itens: z.array(ReferenciaItem).min(1).max(30),
});
export type SyncReferenciasRequest = z.infer<typeof SyncReferenciasRequest>;

// De onde cada nota visual veio (rastreabilidade do perfil).
export const FonteReferencia = z.object({
  arquivo: z.string(),
  notaVisual: z.string().nullable(), // descrição de estilo da imagem (null = só legenda)
});
export type FonteReferencia = z.infer<typeof FonteReferencia>;

// Perfil de estilo derivado — substitui o ESTILO_INDEBA fixo e alimenta o few-shot do texto.
export const PerfilEstilo = z.object({
  descritorVisual: z.string().min(1), // fragmento em INGLÊS p/ o prompt do Flux
  exemplosLegenda: z.array(z.string()), // legendas de referência (tom do texto)
  fontes: z.array(FonteReferencia),
  atualizadoEm: z.string(), // ISO timestamp
});
export type PerfilEstilo = z.infer<typeof PerfilEstilo>;
