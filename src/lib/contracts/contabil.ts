import { z } from "zod";
import { PlanilhaInput } from "./financeiro";

/**
 * Agente Contábil — escrituração e demonstrações com invariantes inquebráveis.
 *
 * REGRA DE OURO (§2, mais rígida que o fiscal): o código FORÇA dois invariantes —
 * (1) partida dobrada: Σdébitos = Σcréditos; (2) equação patrimonial: Ativo = Passivo + PL
 * (+ Resultado). Se D=C, o BP fecha por construção. A IA (§1) só CLASSIFICA conta/natureza
 * e REDIGE análise — nunca inventa saldo nem fecha balanço. Plano de contas é curado.
 */

export const NaturezaConta = z.enum(["ativo", "passivo", "pl", "receita", "custo", "despesa"]);
export type NaturezaConta = z.infer<typeof NaturezaConta>;

export const ContaBalancete = z.object({
  conta: z.string(),
  natureza: NaturezaConta.nullable(),
  debito: z.string(), // decimal string — Σ débitos da conta
  credito: z.string(), // decimal string — Σ créditos da conta
  saldo: z.string(), // decimal string com sinal pela natureza (positivo = saldo normal)
});
export type ContaBalancete = z.infer<typeof ContaBalancete>;

export const ContaValor = z.object({ conta: z.string(), valor: z.string() });

export const BalancoPatrimonial = z.object({
  ativo: z.array(ContaValor),
  passivo: z.array(ContaValor),
  pl: z.array(ContaValor),
  totalAtivo: z.string(),
  totalPassivo: z.string(),
  totalPL: z.string(),
  resultado: z.string(), // resultado do período que compõe o PL
  fecha: z.boolean(), // Ativo == Passivo + PL + Resultado
});

export const DRE = z.object({
  receitas: z.array(ContaValor),
  custos: z.array(ContaValor),
  despesas: z.array(ContaValor),
  totalReceitas: z.string(),
  totalCustos: z.string(),
  totalDespesas: z.string(),
  resultado: z.string(), // receitas − custos − despesas
});

export const Divergencia = z.object({ descricao: z.string(), valor: z.string().nullable() });
export type Divergencia = z.infer<typeof Divergencia>;

export const ContabilRequest = z.object({
  planilha: PlanilhaInput, // diário/razão: 1 linha por partida (data, conta, débito, crédito)
});
export type ContabilRequest = z.infer<typeof ContabilRequest>;

export const ContabilResponse = z.object({
  balancete: z.array(ContaBalancete),
  totalDebitos: z.string(),
  totalCreditos: z.string(),
  partidaDobradaOk: z.boolean(), // Σdébitos == Σcréditos
  divergencias: z.array(Divergencia), // lançamentos/totais que não batem (MOTOR)
  bp: BalancoPatrimonial.nullable(), // null se faltar natureza (plano de contas)
  dre: DRE.nullable(),
  resumo: z.string(), // IA-TEXTO sobre os números do motor
  aviso: z.string().nullable(),
});
export type ContabilResponse = z.infer<typeof ContabilResponse>;
