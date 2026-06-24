/**
 * Orquestrador do Fiscal: XML da NF-e → dados + achados (motor) + resumo (IA).
 */
import type { FiscalRequest, FiscalResponse } from "../contracts";
import { parseNfe } from "./parse";
import { resumirNota } from "./resumir";

export async function processarFiscal(req: FiscalRequest): Promise<FiscalResponse> {
  const { nota, achados } = parseNfe(req.xml);
  const resumo = await resumirNota(nota, achados);
  return { nota, achados, resumo };
}
