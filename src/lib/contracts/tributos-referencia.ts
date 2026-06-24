import { z } from "zod";

/**
 * Catálogo de referência dos tributos brasileiros — a base de conhecimento que o agente
 * fiscal usa para EXPLICAR cada tributo (esfera, incidência, como apurar, status na
 * reforma). Não tem alíquota cravada: os valores variáveis (IRPF, ICMS por estado, ISS
 * por município, IOF...) o agente puxa da fonte datada; aqui é o "o que é / como apura".
 */

export const Esfera = z.enum(["federal", "estadual", "municipal", "reforma"]);
export type Esfera = z.infer<typeof Esfera>;

// vigente | em_extincao (sai na transição da reforma) | novo (IBS/CBS/IS/regime)
export const StatusTributo = z.enum(["vigente", "em_extincao", "novo"]);
export type StatusTributo = z.infer<typeof StatusTributo>;

export const TributoRef = z.object({
  sigla: z.string(),
  nome: z.string(),
  esfera: Esfera,
  grupo: z.string(), // renda, consumo, folha, patrimonio, comercio_exterior, financeiro
  incideSobre: z.string(),
  comoApurar: z.string(),
  status: StatusTributo,
  fonte: z.string(),
});
export type TributoRef = z.infer<typeof TributoRef>;

export const CatalogoTributos = z.object({
  atualizadoEm: z.string(),
  aviso: z.string(),
  tributos: z.array(TributoRef),
});
export type CatalogoTributos = z.infer<typeof CatalogoTributos>;
