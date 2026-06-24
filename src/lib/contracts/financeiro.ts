import { z } from "zod";

/**
 * Agente Financeiro — porta o pacote Python para o stack do projeto.
 *
 * Constituição §1/§2: backbone DETERMINÍSTICO faz toda conta (motor em `src/lib/financeiro`),
 * a IA (Qwen via Ollama) só ROTEIA a intenção e VERBALIZA um resultado já calculado.
 * Nenhum número crítico vem do modelo — alíquota só sai de `tax-rules.json`.
 *
 * Stateless por requisição (roda na Vercel): o front segura as planilhas carregadas e
 * envia o CSV de cada uma junto com a pergunta. O servidor parseia, calcula e responde.
 */

// Intenção que o roteador (Qwen) classifica. Espelha o Pydantic `Intencao` do pacote.
export const IntencaoFinanceira = z.enum([
  "consultar_dado", // somar/contar/média/máx/mín sobre a planilha
  "consolidar", // juntar várias planilhas numa só
  "bater_resultados", // conciliar duas fontes e achar divergências
  "calcular_imposto", // aplicar alíquota da base sobre um valor
  "duvida_tributaria", // dúvida conceitual sobre tributos
  "conversa", // saudação / fora de escopo
]);
export type IntencaoFinanceira = z.infer<typeof IntencaoFinanceira>;

export const MetricaFinanceira = z.enum(["soma", "media", "contagem", "max", "min"]);
export type MetricaFinanceira = z.infer<typeof MetricaFinanceira>;

// Saída do roteador (validada por Zod). `null` quando o campo não se aplica.
export const Roteamento = z.object({
  intencao: IntencaoFinanceira,
  metrica: MetricaFinanceira.nullable().default(null),
  coluna_valor: z.string().nullable().default(null), // coluna numérica alvo
  agrupar_por: z.string().nullable().default(null), // coluna de agrupamento
  filtros: z.record(z.string(), z.string()).nullable().default(null), // {coluna: valor}
  fonte_a: z.string().nullable().default(null), // planilha A (conciliação)
  fonte_b: z.string().nullable().default(null), // planilha B (conciliação)
  chave: z.string().nullable().default(null), // coluna-chave da conciliação
  imposto: z.string().nullable().default(null), // ICMS, ISS, PIS, COFINS...
  regime: z.string().nullable().default(null), // simples | presumido | real
});
export type Roteamento = z.infer<typeof Roteamento>;

// Uma planilha carregada pelo vendedor: nome (vira rótulo de fonte) + conteúdo CSV cru.
export const PlanilhaInput = z.object({
  nome: z.string().min(1).max(120),
  csv: z.string().min(1).max(2_000_000), // ~2MB de CSV por planilha
});
export type PlanilhaInput = z.infer<typeof PlanilhaInput>;

export const FinanceiroRequest = z.object({
  pergunta: z.string().min(1).max(2000),
  planilhas: z.array(PlanilhaInput).max(8).default([]),
  planilhaAtual: z.string().nullable().default(null), // qual é a "ativa" p/ consultas
});
export type FinanceiroRequest = z.infer<typeof FinanceiroRequest>;

export const FinanceiroResponse = z.object({
  resposta: z.string(), // texto em PT verbalizado pela IA (procedência IA-TEXTO)
  tipo: z.string(), // tipo de operação do motor (totalizar, conciliar, ...) ou "conversa"
  resumoNumerico: z.string(), // a VERDADE determinística do motor (procedência MOTOR)
  planilhaAtual: z.string().nullable().default(null), // pode mudar (ex.: consolidar)
});
export type FinanceiroResponse = z.infer<typeof FinanceiroResponse>;
