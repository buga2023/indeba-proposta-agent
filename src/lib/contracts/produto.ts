import { z } from "zod";

// Facetas (spec §3). F1/F3/F4 são listas fechadas [FONTE]; F2 (segmento) é expansível.
export const Linha = z.enum([
  "lavanderia",
  "alimentos_bebidas",
  "limpeza_conservacao",
  "higiene_clinica",
  "higiene_pessoal",
  "tratamento_pisos",
  "automotiva",
]);
export type Linha = z.infer<typeof Linha>;

export const Funcao = z.enum([
  "desengordurante",
  "desinfetante",
  "desincrustante",
  "sabonete",
  "antisseptico",
  "multiuso",
  "cip",
]);
export type Funcao = z.infer<typeof Funcao>;

export const Metodo = z.enum([
  "diluidor_automatico",
  "pulverizacao",
  "imersao",
  "circulacao_cip",
  "manual",
]);
export type Metodo = z.infer<typeof Metodo>;

// Preço SEMPRE como string decimal — nunca float (constituição §1.1, guia §4).
export const Embalagem = z.object({
  tamanho: z.number().positive(),
  unidade: z.enum(["L", "kg", "un", "ml"]),
  preco: z.string().regex(/^\d+\.\d{2}$/, "preço deve ser decimal string, ex '130.00'"),
  diluicaoMax: z.string().nullable(),
  custoDiluido: z.string().nullable(),
});
export type Embalagem = z.infer<typeof Embalagem>;

export const Produto = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  linha: Linha,
  descricaoCurta: z.string(),
  descricaoUso: z.string(),
  segmentos: z.array(z.string()),
  funcoes: z.array(Funcao),
  metodos: z.array(Metodo),
  imagemPath: z.string(),
  fichaTecnicaPath: z.string().nullable(),
  ativo: z.boolean(),
  embalagens: z.array(Embalagem).min(1),
});
export type Produto = z.infer<typeof Produto>;

export const Catalogo = z.object({
  marca: z.enum(["indeba", "indeba_express"]),
  produtos: z.array(Produto),
});
export type Catalogo = z.infer<typeof Catalogo>;
