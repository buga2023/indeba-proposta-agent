import { z } from "zod";
import { Linha, Funcao, Metodo } from "./produto";

// PedidoScope — normalização do briefing (spec §4.2).
// As facetas são extraídas do texto livre pela IA (Marco 2).
export const FacetasDetectadas = z.object({
  linha: z.array(Linha),
  segmento: z.array(z.string()),
  funcao: z.array(Funcao),
  metodo: z.array(Metodo),
});
export type FacetasDetectadas = z.infer<typeof FacetasDetectadas>;

export const PedidoScope = z.object({
  necessidadeTexto: z.string().min(1),
  facetasDetectadas: FacetasDetectadas,
  produtosExplicitos: z.array(z.string()).default([]),
});
export type PedidoScope = z.infer<typeof PedidoScope>;
