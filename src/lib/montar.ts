import { randomUUID } from "node:crypto";
import { carregarCatalogo } from "./catalogo";
import { selecionar } from "./selecao/matcher";
import { extrairPedido } from "./llm/extrair-pedido";
import { escreverApresentacao } from "./llm/escrever-texto";
import { PropostaScope, type PropostaItem, type EntradaEstruturada, type Tipo } from "./contracts";

export type DadosCliente = { razaoSocial: string; cnpj: string | null; segmento: string | null };

// Contexto vindo da prospecção: a "dor" do prospect personaliza o texto de
// apresentação. É só tempero do texto (IA-TEXTO, revisável) — não toca preço/item.
export type ContextoProspeccao = { problema: string; comoAjudar: string };

// Comercial = identidade fabricante (Indeba); Orçamento/Implantação = Express.
const marcaPorTipo = (tipo: Tipo, padrao: "indeba" | "indeba_express") =>
  tipo === "comercial" ? "indeba" : padrao;

const CONDICOES_PADRAO = {
  validade: "15 dias",
  prazoEntrega: "72h após aprovação",
  pagamento: "Faturamento boleto 28 dias",
  frete: "CIF",
};

// Fluxo do produto (spec §2): briefing → PedidoScope → seleção → PropostaScope.
export async function montarProposta(
  briefing: string,
  cliente: DadosCliente,
  tipo: Tipo = "implantacao",
  contexto?: ContextoProspeccao | null,
): Promise<PropostaScope> {
  const catalogo = carregarCatalogo();

  const linhasCatalogo = new Set(catalogo.produtos.map((p) => p.linha));
  const pedido = await extrairPedido(briefing, linhasCatalogo);
  const selecao = selecionar(catalogo.produtos, pedido.facetasDetectadas);

  // Itens: dados críticos copiados do CATÁLOGO; IA só anexa procedência + motivo.
  const itens: PropostaItem[] = selecao.itens.map((sel) => {
    const p = catalogo.produtos.find((x) => x.codigo === sel.codigo)!;
    return {
      codigo: p.codigo,
      nome: p.nome,
      descricaoUso: p.descricaoUso,
      imagemPath: p.imagemPath,
      embalagens: p.embalagens, // [CATÁLOGO] — preço nunca vem da IA
      quantidade: 1, // ajustável na revisão pelo vendedor
      procedenciaSelecao: sel.procedencia,
      motivo: sel.motivo,
    };
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
  });
}

// Caminho estruturado (spec §4.2 produtos_explicitos): o vendedor manda as infos
// prontas. Converge no MESMO PropostaScope → mesmo PDF. Sem IA de seleção.
export async function montarPropostaEstruturada(entrada: EntradaEstruturada): Promise<PropostaScope> {
  const catalogo = carregarCatalogo();

  const itens: PropostaItem[] = entrada.itens.map((it) => {
    if (it.codigo) {
      // referência ao catálogo → preço [CATÁLOGO]
      const p = catalogo.produtos.find((x) => x.codigo === it.codigo);
      if (!p) throw new Error(`Produto "${it.codigo}" não está no catálogo`);
      return {
        codigo: p.codigo,
        nome: p.nome,
        descricaoUso: p.descricaoUso,
        imagemPath: p.imagemPath,
        embalagens: p.embalagens,
        quantidade: it.quantidade ?? 1,
        procedenciaSelecao: "MANUAL",
        motivo: "Selecionado manualmente do catálogo.",
      };
    }
    // item próprio → tudo MANUAL (preço digitado por humano, não pela IA)
    return {
      codigo: slug(it.nome!),
      nome: it.nome!,
      descricaoUso: it.descricaoUso ?? "",
      imagemPath: it.imagemPath ?? "/produtos/_generico.svg",
      embalagens: it.embalagens!,
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
  });
}

const slug = (s: string) =>
  s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "ITEM";
