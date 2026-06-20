import { z } from "zod";
import { Embalagem } from "./produto";
import { Tipo } from "./proposta";

// EntradaEstruturada — o vendedor manda as infos já prontas (sem briefing/IA).
// Item pode REFERENCIAR o catálogo (codigo → preço do CATÁLOGO) ou ser um item
// próprio (nome + embalagens → preço MANUAL, digitado por humano).
export const ItemEntrada = z
  .object({
    codigo: z.string().optional(),
    nome: z.string().optional(),
    descricaoUso: z.string().optional(),
    imagemPath: z.string().optional(),
    embalagens: z.array(Embalagem).optional(),
    quantidade: z.number().int().positive().optional(),
  })
  .refine((i) => Boolean(i.codigo) || Boolean(i.nome && i.embalagens?.length), {
    message: "informe 'codigo' (catálogo) ou 'nome' + 'embalagens' (item manual)",
  });
export type ItemEntrada = z.infer<typeof ItemEntrada>;

export const EntradaEstruturada = z.object({
  tipo: Tipo.optional(),
  cliente: z.object({
    razaoSocial: z.string().min(1),
    cnpj: z.string().nullable().default(null),
    segmento: z.string().nullable().default(null),
  }),
  itens: z.array(ItemEntrada).min(1),
  textoApresentacao: z.string().optional(), // se vier, procedência MANUAL
  condicoes: z
    .object({
      validade: z.string(),
      prazoEntrega: z.string(),
      pagamento: z.string(),
      frete: z.string(),
    })
    .partial()
    .optional(),
});
export type EntradaEstruturada = z.infer<typeof EntradaEstruturada>;
