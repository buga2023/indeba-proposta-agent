import { z } from "zod";

// SelecaoExplicada — por que cada produto entrou (spec §4.3).
export const SelecaoItem = z.object({
  codigo: z.string(),
  score: z.number(),
  facetasBatidas: z.array(z.string()),
  motivo: z.string(),
  procedencia: z.enum(["IA-SELEÇÃO", "MANUAL"]),
});
export type SelecaoItem = z.infer<typeof SelecaoItem>;

export const SelecaoExplicada = z.object({
  itens: z.array(SelecaoItem),
});
export type SelecaoExplicada = z.infer<typeof SelecaoExplicada>;
