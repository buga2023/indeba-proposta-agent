import { z } from "zod";

// Empresa da base da Receita, na forma de transporte/exibição (telefones já como
// lista, endereço composto). É a fonte determinística da prospecção: tudo aqui tem
// origem na Receita Federal, nunca no modelo (constituição §1/§2).
export const EmpresaProspecto = z.object({
  cnpj: z.string(),
  razaoSocial: z.string(),
  nomeFantasia: z.string().nullable(),
  cnaePrincipal: z.string(),
  segmento: z.string(), // rótulo legível do segmento (do mapa nicho→CNAE)
  uf: z.string(),
  municipio: z.string().nullable(),
  telefones: z.array(z.string()),
  email: z.string().nullable(),
  endereco: z.string().nullable(),
});
export type EmpresaProspecto = z.infer<typeof EmpresaProspecto>;
