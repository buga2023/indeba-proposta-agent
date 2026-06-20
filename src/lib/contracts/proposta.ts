import { z } from "zod";
import { Embalagem } from "./produto";

// PropostaScope — objeto canônico que vira PDF (spec §4.4).
// Campos do item marcados [CATÁLOGO] são cópia direta do catálogo.
// A IA só preenche `textoApresentacao` e `procedenciaSelecao`.
export const ClienteSnapshot = z.object({
  razaoSocial: z.string(),
  cnpj: z.string().nullable(),
  segmento: z.string().nullable(),
});

export const PropostaItem = z.object({
  codigo: z.string(), // [CATÁLOGO]
  nome: z.string(), // [CATÁLOGO]
  descricaoUso: z.string(), // [CATÁLOGO]
  imagemPath: z.string(), // [CATÁLOGO]
  embalagens: z.array(Embalagem), // [CATÁLOGO]
  procedenciaSelecao: z.enum(["IA-SELEÇÃO", "MANUAL"]),
  motivo: z.string(),
});
export type PropostaItem = z.infer<typeof PropostaItem>;

// 3 tipos de proposta (estrutura do documento). Detectado pelo prompt; ver
// docs/estrutura-modelos.md. Eixo separado de `template` (identidade visual).
export const Tipo = z.enum(["orcamento", "implantacao", "comercial"]);
export type Tipo = z.infer<typeof Tipo>;

export const PropostaScope = z.object({
  id: z.string(),
  criadoEm: z.string(),
  status: z.enum(["rascunho", "finalizada"]),
  tipo: Tipo,
  template: z.enum(["indeba", "indeba_express"]),
  cliente: ClienteSnapshot,
  textoApresentacao: z.object({
    conteudo: z.string(),
    procedencia: z.enum(["IA-TEXTO", "MANUAL"]),
  }),
  itens: z.array(PropostaItem),
  condicoesComerciais: z.object({
    validade: z.string(),
    prazoEntrega: z.string(),
    pagamento: z.string(),
    frete: z.string(),
  }),
});
export type PropostaScope = z.infer<typeof PropostaScope>;
