import { randomUUID } from "node:crypto";
import { carregarCatalogo, produtoPorCodigo } from "./catalogo";
import { selecionar } from "./selecao/matcher";
import { extrairPedido } from "./llm/extrair-pedido";
import { escreverApresentacao } from "./llm/escrever-texto";
import { PropostaScope, type PropostaItem, type EntradaEstruturada, type Tipo } from "./contracts";
import { consolidadaDefaults } from "./consolidada-defaults";

export type DadosCliente = {
  razaoSocial: string;
  cnpj: string | null;
  segmento: string | null;
  responsavel?: string | null; // quem recebe a proposta (capa Express)
};

// Contexto vindo da prospecção: a "dor" do prospect personaliza o texto de
// apresentação. É só tempero do texto (IA-TEXTO, revisável) — não toca preço/item.
export type ContextoProspeccao = { problema: string; comoAjudar: string };

// Quem está logado (nome/e-mail do cadastro) — vira "consultor"/"emailConsultor" na
// Consolidada. Sem sessão (dev local), cai nos defaults de consolidadaDefaults/env.
export type ConsultorInfo = { nome: string; email?: string | null };

// Comercial = identidade fabricante (Indeba); Orçamento/Implantação = Express.
const marcaPorTipo = (tipo: Tipo, padrao: "indeba" | "indeba_express") =>
  tipo === "comercial" ? "indeba" : padrao;

const CONDICOES_PADRAO = {
  validade: "15 dias",
  prazoEntrega: "72h após aprovação",
  pagamento: "Faturamento boleto 28 dias",
  frete: "CIF",
};

// Quando tipo === "consolidada", anexa os textos institucionais default (editáveis
// depois na revisão). Para os demais tipos, retorna undefined (campo omitido).
// `consultor` vem da sessão (nome/e-mail do cadastro) — cai no default do
// consolidadaDefaults (Matheus Maristane Resende) quando não há sessão ativa (auth
// desligada localmente). WhatsApp segue vindo de env (não há telefone por usuário);
// o e-mail do consultor prioriza o do usuário logado, com INDEBA_CONSULTOR_EMAIL como
// fallback (dev local sem sessão). Vazio = PDF não exibe contato nenhum (a Revisão
// avisa visivelmente quando os dois estão vazios).
const blocoConsolidada = (tipo: Tipo, consultor?: ConsultorInfo | null) =>
  tipo === "consolidada"
    ? consolidadaDefaults({
        consultor: consultor?.nome ?? undefined,
        whatsapp: process.env.INDEBA_WHATSAPP || null,
        emailConsultor: consultor?.email || process.env.INDEBA_CONSULTOR_EMAIL || null,
      })
    : undefined;

// Fluxo do produto (spec §2): briefing → PedidoScope → seleção → PropostaScope.
export async function montarProposta(
  briefing: string,
  cliente: DadosCliente,
  tipo: Tipo = "implantacao",
  contexto?: ContextoProspeccao | null,
  consultor?: ConsultorInfo | null,
): Promise<PropostaScope> {
  const catalogo = carregarCatalogo();

  const linhasCatalogo = new Set(catalogo.produtos.map((p) => p.linha));
  const pedido = await extrairPedido(briefing, linhasCatalogo);
  const selecao = selecionar(catalogo.produtos, pedido.facetasDetectadas);

  // Itens: dados críticos copiados do CATÁLOGO; IA só anexa procedência + motivo.
  // Catálogo pode estar sem preço (o valor autoritativo vem do orçamento importado):
  // embalagem sem preço não entra; produto sem NENHUM preço sai da seleção — proposta
  // não carrega valor inventado (lacuna sinalizada pela seleção vazia/menor).
  const itens: PropostaItem[] = selecao.itens.flatMap((sel) => {
    const p = catalogo.produtos.find((x) => x.codigo === sel.codigo)!;
    const embalagens = p.embalagens.filter((e): e is (typeof p.embalagens)[number] & { preco: string } => e.preco !== null);
    if (embalagens.length === 0) return [];
    return [{
      codigo: p.codigo,
      nome: p.nome,
      descricaoUso: p.descricaoUso,
      imagemPath: p.imagemPath,
      embalagens, // [CATÁLOGO] — preço nunca vem da IA
      ficha: p.ficha ?? null, // [CATÁLOGO] snapshot p/ página de produto (consolidada)
      quantidade: 1, // ajustável na revisão pelo vendedor
      procedenciaSelecao: sel.procedencia,
      motivo: sel.motivo,
    }];
  });

  const texto = await escreverApresentacao(
    cliente.razaoSocial,
    cliente.segmento,
    itens.map((i) => ({
      nome: i.nome,
      funcoes: catalogo.produtos.find((p) => p.codigo === i.codigo)?.funcoes ?? [],
    })),
    contexto?.problema || null,
  );

  return PropostaScope.parse({
    id: randomUUID(),
    criadoEm: new Date().toISOString(),
    status: "rascunho",
    tipo,
    template: marcaPorTipo(tipo, catalogo.marca),
    cliente,
    textoApresentacao: texto,
    itens,
    condicoesComerciais: CONDICOES_PADRAO,
    consolidada: blocoConsolidada(tipo, consultor),
  });
}

// Caminho estruturado (spec §4.2 produtos_explicitos): o vendedor manda as infos
// prontas. Converge no MESMO PropostaScope → mesmo PDF. Sem IA de seleção.
export async function montarPropostaEstruturada(
  entrada: EntradaEstruturada,
  consultor?: ConsultorInfo | null,
): Promise<PropostaScope> {
  const catalogo = carregarCatalogo();

  const itens: PropostaItem[] = entrada.itens.map((it) => {
    if (it.codigo) {
      // Referência ao catálogo → foto/descrição do CATÁLOGO. Preço: se o item
      // trouxe embalagens (orçamento importado), ELAS prevalecem — o catálogo
      // pode nem ter preço; senão, preço do catálogo (proposta manual).
      const p = catalogo.produtos.find((x) => x.codigo === it.codigo);
      if (!p) throw new Error(`Produto "${it.codigo}" não está no catálogo`);
      const doCatalogo = p.embalagens.filter((e): e is (typeof p.embalagens)[number] & { preco: string } => e.preco !== null);
      const embalagens = it.embalagens?.length ? it.embalagens : doCatalogo;
      if (embalagens.length === 0) {
        throw new Error(`Produto "${p.nome}" está sem preço no catálogo — informe o valor (orçamento importado ou item próprio)`);
      }
      return {
        codigo: p.codigo,
        nome: p.nome,
        descricaoUso: p.descricaoUso,
        imagemPath: p.imagemPath,
        embalagens,
        ficha: p.ficha ?? null, // [CATÁLOGO] snapshot p/ página de produto (consolidada)
        quantidade: it.quantidade ?? 1,
        procedenciaSelecao: "MANUAL",
        motivo: it.embalagens?.length
          ? "Produto do catálogo com valor do orçamento importado."
          : "Selecionado manualmente do catálogo.",
      };
    }
    // item próprio → tudo MANUAL (preço digitado por humano, não pela IA)
    return {
      codigo: slug(it.nome!),
      nome: it.nome!,
      descricaoUso: it.descricaoUso ?? "",
      imagemPath: it.imagemPath ?? "/produtos/_generico.svg",
      embalagens: it.embalagens!,
      ficha: null, // item próprio não tem ficha de catálogo
      quantidade: it.quantidade ?? 1,
      procedenciaSelecao: "MANUAL",
      motivo: "Item informado manualmente pelo vendedor.",
    };
  });

  const texto = entrada.textoApresentacao
    ? { conteudo: entrada.textoApresentacao, procedencia: "MANUAL" as const }
    : await escreverApresentacao(
        entrada.cliente.razaoSocial,
        entrada.cliente.segmento,
        itens.map((i) => ({
          nome: i.nome,
          funcoes: catalogo.produtos.find((p) => p.codigo === i.codigo)?.funcoes ?? [],
        })),
      );

  const tipo = entrada.tipo ?? "implantacao";
  return PropostaScope.parse({
    id: randomUUID(),
    criadoEm: new Date().toISOString(),
    status: "rascunho",
    tipo,
    template: marcaPorTipo(tipo, catalogo.marca),
    cliente: entrada.cliente,
    textoApresentacao: texto,
    itens,
    condicoesComerciais: { ...CONDICOES_PADRAO, ...entrada.condicoes },
    consolidada: blocoConsolidada(tipo, consultor),
  });
}

const slug = (s: string) =>
  s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "ITEM";

// Resolve um código do catálogo → PropostaItem com preço/ficha/imagem do CATÁLOGO —
// usado pelo chat de correção (adicionar_item_catalogo): a IA só emite o `codigo`
// (classificação), o preço vem sempre daqui, nunca da IA. Lança se o produto não
// existir ou não tiver nenhum preço cadastrado (chamador decide como comunicar).
export function itemDoCatalogo(codigo: string, quantidade = 1): PropostaItem {
  const p = produtoPorCodigo(codigo);
  if (!p) throw new Error(`Produto "${codigo}" não está no catálogo`);
  const embalagens = p.embalagens.filter((e): e is (typeof p.embalagens)[number] & { preco: string } => e.preco !== null);
  if (embalagens.length === 0) throw new Error(`Produto "${p.nome}" está sem preço no catálogo`);
  return {
    codigo: p.codigo,
    nome: p.nome,
    descricaoUso: p.descricaoUso,
    imagemPath: p.imagemPath,
    embalagens,
    ficha: p.ficha ?? null,
    quantidade: Math.max(1, Math.round(quantidade)),
    procedenciaSelecao: "MANUAL",
    motivo: "Adicionado pelo chat de correção.",
  };
}
