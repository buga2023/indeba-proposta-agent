import { z } from "zod";
import { Embalagem, FichaProduto } from "./produto";

// PropostaScope — objeto canônico que vira PDF (spec §4.4).
// Campos do item marcados [CATÁLOGO] são cópia direta do catálogo.
// A IA só preenche `textoApresentacao` e `procedenciaSelecao`.
export const ClienteSnapshot = z.object({
  razaoSocial: z.string(),
  cnpj: z.string().nullable(),
  segmento: z.string().nullable(),
  // Quem recebe a proposta no cliente (capa Express/consolidada). Default null:
  // propostas antigas persistidas continuam parseando.
  responsavel: z.string().nullable().default(null),
});

export const PropostaItem = z.object({
  codigo: z.string(), // [CATÁLOGO]
  nome: z.string(), // [CATÁLOGO]
  descricaoUso: z.string(), // [CATÁLOGO]
  imagemPath: z.string(), // [CATÁLOGO]
  // Embalagens COTADAS — só o que o consultor escolheu, cada uma com o preço daquele
  // tamanho. Um produto pedido em 5 L e em 20 L entra como DOIS itens (a tela chaveia
  // a seleção por produto+tamanho), nunca como um item com duas embalagens. Antes a
  // montagem mandava todos os tamanhos do catálogo replicando o mesmo preço — o total
  // saía inconsistente e o cliente lia tamanho não ofertado com valor (spec Item 3).
  embalagens: z.array(Embalagem), // [CATÁLOGO]
  // Tamanhos que o produto TEM na ficha técnica, sem preço — alimenta o bloco
  // "Embalagens disponíveis" da ficha (decisão do cliente, áudio 16:24), que não pode
  // depender da lista de cotadas. Opcional: proposta antiga persistida não tem o campo
  // e continua parseando — nesse caso o template cai na lista de embalagens, como antes.
  tamanhosDisponiveis: z
    .array(z.object({ tamanho: z.number().positive(), unidade: z.enum(["L", "kg", "un", "ml"]) }))
    .optional(),
  ficha: FichaProduto.nullable().optional(), // [CATÁLOGO] snapshot p/ página de produto
  // [CATÁLOGO] caminho estático do PDF da ficha técnica real (ex. "/fichas-tecnicas/AUTOCAR-PLUS.pdf").
  // null = produto sem ficha técnica cadastrada ainda. Default null: propostas antigas
  // persistidas continuam parseando sem o campo.
  fichaTecnicaPath: z.string().nullable().default(null),
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
    // descricao opcional: os cards de comodato passaram a ser só título + ícone
    // (pedido do Matheus, jul/2026); com texto continua renderizando (compat).
    equipamentos: z.array(z.object({ titulo: z.string(), descricao: z.string().optional(), icone: z.string() })),
    vantagens: z.array(z.string()),
  }),
  condicoes: z.object({
    itens: z.array(z.object({ titulo: z.string(), texto: z.string(), icone: z.string() })),
    mensagemFechamento: z.string(),
    consultor: z.string(),
    cargo: z.string(),
  }),
  // Contatos exibidos no rodapé da ficha de produto e no card de fechamento das
  // condições. Payload/config — nunca chumbado no template. null = não exibe.
  // Default: propostas antigas persistidas continuam parseando.
  contato: z
    .object({
      whatsapp: z.string().nullable(), // telefone do consultor (fallback: WhatsApp da Indeba/env)
      emailConsultor: z.string().nullable(),
    })
    .default({ whatsapp: null, emailConsultor: null }),
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
  /**
   * Consultor que assina a proposta — vale para TODOS os tipos.
   *
   * Existia só dentro de `consolidada` (capa/condições/contato), então Orçamento e
   * Implantação, que usam a capa Express, saíam com o nome chumbado no template
   * ("Matheus Resende") não importa quem tivesse montado — achado no teste em produção de
   * 02/09/2026. Aqui o nome viaja com a proposta: preenchido na montagem com quem está
   * logado, reescrito na transferência de carteira, e o template cai no default antigo
   * quando a proposta é anterior a este campo (por isso nullable, não obrigatório).
   */
  consultor: z
    .object({
      nome: z.string(),
      email: z.string().nullable().default(null),
      telefone: z.string().nullable().default(null),
    })
    .nullable()
    .optional(),
});
export type PropostaScope = z.infer<typeof PropostaScope>;

// ── Persistência (registro comercial da proposta) ──
// Status COMERCIAL, MUTÁVEL — eixo separado do `status` do documento (rascunho/finalizada).
// A proposta gerada é persistida (store de trabalho); o log append-only (lib/log.ts)
// continua sendo a auditoria imutável de cada PDF emitido (constituição §8).
// `arquivada` entrou depois: 31 propostas já tinham esse status no banco (arquivamento
// feito direto no Postgres, fora do app — nada no código escrevia o valor). Como a coluna
// é String livre, elas passavam pelo INSERT e só explodiam na leitura, derrubando o
// histórico inteiro com 500. Faltava no enum, não era dado corrompido.
export const StatusProposta = z.enum(["rascunho", "em_edicao", "enviada", "em_andamento", "aprovada", "recusada", "arquivada"]);
export type StatusProposta = z.infer<typeof StatusProposta>;

// Linha do histórico — leve (sem o scope inteiro) para listar.
export const PropostaResumo = z.object({
  id: z.string(),
  status: StatusProposta,
  autor: z.string(),
  // Nome de quem lançou, resolvido na leitura contra o cadastro (áudio do Mateus,
  // 02/09/2026: "não está aparecendo o nome da pessoa que lançou"). Null = conta
  // removida; a tela cai no e-mail.
  autorNome: z.string().nullable().default(null),
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

// Transferência de carteira (PATCH, só admin — áudio do Mateus, 02/09/2026: "lancei
// ontem uma proposta e não consigo transferir para ele, porque fica atrelada a quem
// lançou"). Muda o DONO da proposta e, junto, o consultor que assina a capa: transferir
// só a linha do banco deixaria o PDF saindo com o nome de quem digitou.
export const TransferenciaUpdate = z.object({ autor: z.string().trim().email().max(200) });
export type TransferenciaUpdate = z.infer<typeof TransferenciaUpdate>;
