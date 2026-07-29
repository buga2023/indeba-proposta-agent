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

// Marca do produto (o catálogo reúne as duas linhas da Indeba). Facet fechada,
// usada como filtro no Catálogo.
export const Marca = z.enum(["indeba", "pratt"]);
export type Marca = z.infer<typeof Marca>;

// Preço SEMPRE como string decimal — nunca float (constituição §1.1, guia §4).
export const Embalagem = z.object({
  tamanho: z.number().positive(),
  unidade: z.enum(["L", "kg", "un", "ml"]),
  preco: z.string().regex(/^\d+\.\d{2}$/, "preço deve ser decimal string, ex '130.00'"),
  diluicaoMax: z.string().nullable(),
  custoDiluido: z.string().nullable(),
  // Alguns produtos mudam de embalagem física por tamanho (garrafa/galão/tambor) —
  // foto diferente por tamanho, e é essa que vale para o tamanho cotado. Cadastrada nos
  // que têm as duas fotos de estúdio (City T em 5 L, Primmax CIP DT em 7,5 kg, Primmax
  // CIP Nitro em 6,6 kg, Primmax Sanap em 5 kg, Texspar Degrease em 5 L). Ausente: cai no
  // `fotoEmbalagem`/arte de recipiente do produto — ver lib/imagem-produto.ts.
  imagemPath: z.string().nullable().optional(),
});
export type Embalagem = z.infer<typeof Embalagem>;

// Ficha rica de vendas (modelo Proposta Consolidada). Tudo opcional — o template
// de PDF omite o bloco quando o dado não existe. Nada aqui é inventado pela IA:
// são dados técnicos cadastrados por produto.
export const FichaProduto = z.object({
  titulo: z.string().optional(),        // "Detergente Desengordurante"
  subtitulo: z.string().optional(),     // "Alcalino Concentrado"
  linhaLabel: z.string().optional(),    // "KITCHEN"
  descricao: z.string().optional(),     // parágrafo hero
  indicadoPara: z.array(z.object({ label: z.string(), icone: z.string() })).optional(),
  beneficios: z.array(z.string()).optional(),
  diluicoes: z.array(z.object({
    uso: z.string(),                    // "Finalidade de uso"
    razao: z.string(),                  // "Diluição"
    comoAplicar: z.string().optional(), // "Como aplicar" — 3ª coluna, quando a ficha técnica real traz o modo de aplicação
  })).optional(),
  rendimento: z.string().optional(),
  caracteristicas: z
    .object({
      pH: z.string().optional(),
      aspecto: z.string().optional(),
      cor: z.string().optional(),
      odor: z.string().optional(),
      uso: z.string().optional(),
      densidade: z.string().optional(),
      cloroAtivo: z.string().optional(),
    })
    .optional(),
});
export type FichaProduto = z.infer<typeof FichaProduto>;

// No CATÁLOGO o preço pode ficar vazio: o catálogo é fonte de produto (foto,
// descrição, facetas); o valor autoritativo chega pelo orçamento importado.
// A PROPOSTA continua exigindo Embalagem com preço — documento sem preço não sai.
export const EmbalagemCatalogo = Embalagem.extend({
  preco: Embalagem.shape.preco.nullable(),
});
export type EmbalagemCatalogo = z.infer<typeof EmbalagemCatalogo>;

export const Produto = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  marca: Marca,
  linha: Linha,
  descricaoCurta: z.string(),
  descricaoUso: z.string(),
  segmentos: z.array(z.string()),
  funcoes: z.array(Funcao),
  metodos: z.array(Metodo),
  imagemPath: z.string(),
  // Qual recipiente a foto de estúdio mostra. A foto é UMA, e um produto vendido em
  // 20 L e 50 L só tem foto de um dos dois: sem essa marcação, cotar 20 L de Texspar DSA
  // exibia a bombona de 50 L da foto (lista do Gustavo, jul/2026). Com ela,
  // `imagemDaEmbalagem` (lib/imagem-produto.ts) troca por arte do recipiente cotado.
  // Ausente = foto vale para qualquer tamanho (produto de tamanho único, ou não auditado).
  fotoEmbalagem: z
    .object({ tamanho: z.number().positive(), unidade: Embalagem.shape.unidade })
    .nullable()
    .optional(),
  fichaTecnicaPath: z.string().nullable(),
  ativo: z.boolean(),
  embalagens: z.array(EmbalagemCatalogo).min(1),
  ficha: FichaProduto.nullable().optional(),
});
export type Produto = z.infer<typeof Produto>;

export const Catalogo = z.object({
  marca: z.enum(["indeba", "indeba_express"]),
  produtos: z.array(Produto),
});
export type Catalogo = z.infer<typeof Catalogo>;
