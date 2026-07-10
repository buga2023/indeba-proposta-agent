import { z } from "zod";
import { Embalagem, FichaProduto } from "./produto";

// PropostaScope — objeto canônico que vira PDF (spec §4.4).
// Campos do item marcados [CATÁLOGO] são cópia direta do catálogo.
// A IA só preenche `textoApresentacao` e `procedenciaSelecao`.
export const ClienteSnapshot = z.object({
  razaoSocial: z.string(),
  cnpj: z.string().nullable(),
  segmento: z.string().nullable(),
  responsavel: z.string().nullable().optional(),
});

export const PropostaItem = z.object({
  codigo: z.string(), // [CATÁLOGO]
  nome: z.string(), // [CATÁLOGO]
  descricaoUso: z.string(), // [CATÁLOGO]
  imagemPath: z.string(), // [CATÁLOGO]
  embalagens: z.array(Embalagem), // [CATÁLOGO]
  ficha: FichaProduto.nullable().optional(), // [CATÁLOGO] snapshot p/ página de produto
  // Quantidade ajustável pelo vendedor na tela de revisão. Subtotal = preço da
  // 1ª embalagem × quantidade (modelo de orçamento). Default 1.
  quantidade: z.number().int().positive().default(1),
  procedenciaSelecao: z.enum(["IA-SELEÇÃO", "MANUAL"]),
  motivo: z.string(),
});
export type PropostaItem = z.infer<typeof PropostaItem>;

// 3 tipos de proposta (estrutura do documento). Detectado pelo prompt; ver
// docs/estrutura-modelos.md. Eixo separado de `template` (identidade visual).
export const Tipo = z.enum(["orcamento", "implantacao", "comercial", "consolidada"]);
export type Tipo = z.infer<typeof Tipo>;

// Textos institucionais do modelo Consolidado (marca IES). Presente só quando
// tipo === "consolidada". Preenchido por consolidadaDefaults() na montagem;
// editável na revisão (Fase 2). Cliente/CNPJ/segmento/data vêm de outros campos.
export const ConsolidadaBloco = z.object({
  capa: z.object({ consultor: z.string(), cidade: z.string(), subtitulo: z.string() }),
  apresentacao: z.object({
    saudacao: z.string(),
    paragrafos: z.array(z.string()),
    cards: z.array(z.object({ titulo: z.string(), texto: z.string(), icone: z.string() })),
  }),
  comodatos: z.object({
    intro: z.string(),
    equipamentos: z.array(z.object({ titulo: z.string(), descricao: z.string(), icone: z.string() })),
    vantagens: z.array(z.string()),
  }),
  condicoes: z.object({
    itens: z.array(z.object({ titulo: z.string(), texto: z.string(), icone: z.string() })),
    mensagemFechamento: z.string(),
    consultor: z.string(),
    cargo: z.string(),
  }),
});
export type ConsolidadaBloco = z.infer<typeof ConsolidadaBloco>;

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
  consolidada: ConsolidadaBloco.optional(),
});
export type PropostaScope = z.infer<typeof PropostaScope>;

// ── Persistência (registro comercial da proposta) ──
// Status COMERCIAL, MUTÁVEL — eixo separado do `status` do documento (rascunho/finalizada).
// A proposta gerada é persistida (store de trabalho); o log append-only (lib/log.ts)
// continua sendo a auditoria imutável de cada PDF emitido (constituição §8).
export const StatusProposta = z.enum(["rascunho", "em_edicao", "enviada", "aprovada", "recusada"]);
export type StatusProposta = z.infer<typeof StatusProposta>;

// Linha do histórico — leve (sem o scope inteiro) para listar.
export const PropostaResumo = z.object({
  id: z.string(),
  status: StatusProposta,
  autor: z.string(),
  cliente: z.string(), // razão social (denormalizado do scope)
  segmento: z.string().nullable(),
  tipo: Tipo,
  total: z.string(), // decimal string — Σ subtotais (mesma convenção do log.ts)
  qtdItens: z.number().int().nonnegative(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type PropostaResumo = z.infer<typeof PropostaResumo>;

// Registro completo — resumo + o PropostaScope canônico (para reabrir e gerar contrato).
export const PropostaRegistro = PropostaResumo.extend({ scope: PropostaScope });
export type PropostaRegistro = z.infer<typeof PropostaRegistro>;

// Mudança de status (PATCH).
export const StatusUpdate = z.object({ status: StatusProposta });
export type StatusUpdate = z.infer<typeof StatusUpdate>;
