import { z } from "zod";
import { prisma } from "@/lib/db";
import type { SessaoUsuario } from "@/lib/auth";
import { nomeDeAutor } from "@/lib/autores";
import type { DocumentoComprovante } from "@/lib/pdf/template-comprovante";

/**
 * Comprovante em PDF de UM registro (áudio do Mateus, 31/08/2026: "em todos os registros,
 * dê a opção da gente também importar em PDF… como se fosse um documento de comprovação,
 * com a foto, com tudo que foi registrado").
 *
 * Este módulo só faz a tradução registro → documento; quem desenha é
 * pdf/template-comprovante.ts e quem imprime é pdf/render.ts. A regra que ele guarda —
 * e a razão de a leitura não ficar espalhada nas rotas — é o ESCOPO: o vendedor só tira
 * comprovante do que é dele, o gestor de qualquer um. É o mesmo recorte das listagens,
 * porque o comprovante é uma segunda porta para o mesmo dado: afrouxar aqui vazaria o
 * registro do colega em PDF, com foto e tudo.
 *
 * Registros com lápide (aba Excluídos) continuam imprimíveis de propósito: comprovante de
 * algo que foi excluído é justamente o que se guarda.
 */

export const TipoComprovante = z.enum(["prospeccao", "visita", "solicitacao", "contrato", "estoque"]);
export type TipoComprovante = z.infer<typeof TipoComprovante>;

function escopo(usuario: SessaoUsuario) {
  return usuario.papel === "admin" ? {} : { autor: usuario.email };
}

const dataHora = (d: Date) => d.toLocaleString("pt-BR");

const TITULOS: Record<TipoComprovante, string> = {
  prospeccao: "Registro de Prospecção",
  visita: "Registro de Visita de Rotina",
  solicitacao: "Solicitação Comercial",
  contrato: "Contrato / Comodato",
  estoque: "Estoque de Comodatos",
};

// Rótulos legíveis dos enums — o PDF é lido por gente, não pelo sistema.
const ROTULO_TIPO_SOLICITACAO: Record<string, string> = {
  analise_agua_tecidos: "Análise de água e/ou tecidos",
  analise_produtos_quimicos: "Análise de produtos químicos",
  visita_setor_tecnico: "Visita do setor técnico",
  amostra_demonstracao: "Amostra para demonstração",
  outras_solicitacoes: "Outras solicitações",
};

/** Fotos e nomes de documento da tabela Anexo (prospecção, solicitação, contrato, estoque). */
async function anexosDoRegistro(tipo: string, registroId: string) {
  const rows = await prisma.anexo.findMany({
    where: { registroTipo: tipo, registroId },
    orderBy: { criadoEm: "asc" },
  });
  return {
    fotos: rows
      .filter((r) => r.categoria === "foto" && r.mime.startsWith("image/"))
      .map((r) => `data:${r.mime};base64,` + Buffer.from(r.bytes).toString("base64")),
    documentos: rows.filter((r) => r.categoria !== "foto").map((r) => r.nome ?? "documento"),
  };
}

/**
 * Monta o documento, ou devolve null quando o registro não existe OU não é do usuário —
 * os dois casos viram o mesmo 404 na rota, de propósito: distinguir contaria a quem
 * bisbilhota que o id existe.
 */
export async function montarComprovante(
  usuario: SessaoUsuario,
  tipo: TipoComprovante,
  id: string,
): Promise<DocumentoComprovante | null> {
  const where = { id, ...escopo(usuario) };

  if (tipo === "prospeccao") {
    const r = await prisma.relatorioProspeccao.findFirst({ where });
    if (!r) return null;
    const anexos = await anexosDoRegistro("prospeccao", r.id);
    return {
      titulo: TITULOS.prospeccao,
      registroId: r.id,
      campos: [
        { rotulo: "Empresa", valor: r.empresa },
        { rotulo: "Data da prospecção", valor: r.horario ? `${r.data} às ${r.horario}` : r.data },
        { rotulo: "Com quem falou", valor: r.contato ?? "" },
        { rotulo: "Telefone", valor: r.telefone ?? "" },
        ...(await camposDeAutoria(r.autor, r.criadoEm, r.atualizadoEm, r.excluidoEm)),
      ],
      textos: [{ rotulo: "Observação", valor: r.observacao ?? "" }],
      ...anexos,
    };
  }

  if (tipo === "solicitacao") {
    const r = await prisma.solicitacaoComercial.findFirst({ where });
    if (!r) return null;
    const anexos = await anexosDoRegistro("solicitacao", r.id);
    return {
      titulo: TITULOS.solicitacao,
      registroId: r.id,
      campos: [
        { rotulo: "Cliente", valor: r.cliente },
        { rotulo: "Tipo de solicitação", valor: ROTULO_TIPO_SOLICITACAO[r.tipo] ?? r.tipo },
        { rotulo: "Situação", valor: r.status === "atendida" ? "Atendida" : "Pendente" },
        ...(await camposDeAutoria(r.autor, r.criadoEm, r.atualizadoEm, r.excluidoEm)),
      ],
      textos: [{ rotulo: "Observação", valor: r.observacao ?? "" }],
      ...anexos,
    };
  }

  if (tipo === "contrato") {
    const r = await prisma.contratoComodato.findFirst({ where });
    if (!r) return null;
    const anexos = await anexosDoRegistro("contrato", r.id);
    return {
      titulo: TITULOS.contrato,
      registroId: r.id,
      campos: [
        { rotulo: "Cliente", valor: r.cliente },
        ...(await camposDeAutoria(r.autor, r.criadoEm, r.atualizadoEm, r.excluidoEm)),
      ],
      textos: [
        { rotulo: "Comodatos", valor: r.comodatos },
        { rotulo: "Observações", valor: r.observacoes ?? "" },
      ],
      fotos: anexos.fotos,
      // O contrato legado mora na própria linha, não na tabela Anexo — listá-lo junto
      // evita um comprovante que diz "nenhum documento" tendo o PDF do contrato anexado.
      documentos: [...anexos.documentos, ...(r.contratoMime ? ["Contrato assinado (arquivo original no sistema)"] : [])],
    };
  }

  if (tipo === "estoque") {
    const r = await prisma.estoqueComodato.findFirst({ where });
    if (!r) return null;
    const anexos = await anexosDoRegistro("estoque", r.id);
    return {
      titulo: TITULOS.estoque,
      registroId: r.id,
      campos: [
        { rotulo: "Código", valor: r.codigo },
        { rotulo: "Peça", valor: r.peca },
        { rotulo: "Quantidade", valor: String(r.quantidade) },
        ...(await camposDeAutoria(r.autor, r.criadoEm, r.atualizadoEm, r.excluidoEm)),
      ],
      textos: [{ rotulo: "Observação", valor: r.obs ?? "" }],
      ...anexos,
    };
  }

  // Visita: fotos e documento moram na própria linha (VisitaFoto + colunas), não em Anexo.
  const r = await prisma.visitaCarteira.findFirst({ where, include: { fotos: { orderBy: { criadoEm: "asc" } } } });
  if (!r) return null;
  return {
    titulo: TITULOS.visita,
    registroId: r.id,
    campos: [
      { rotulo: "Cliente", valor: r.cliente },
      { rotulo: "Data da visita", valor: `${r.data} às ${r.horario}` },
      { rotulo: "Quem recebeu", valor: r.quemRecebeu },
      { rotulo: "Telefone", valor: r.telefone ?? "" },
      { rotulo: "Situação", valor: r.status === "resolvido" ? "Resolvido" : "Não resolvido" },
      { rotulo: "Área", valor: r.area === "comercial" ? "Comercial" : "Técnica" },
      ...(await camposDeAutoria(r.autor, r.criadoEm, r.atualizadoEm, r.excluidoEm)),
    ],
    textos: [{ rotulo: "Observação", valor: r.observacao ?? "" }],
    fotos: r.fotos.map((f) => `data:${f.fotoMime};base64,` + Buffer.from(f.foto).toString("base64")),
    documentos: r.documentoMime ? [r.documentoNome ?? "Documento anexado"] : [],
  };
}

// O rodapé de autoria é igual em todos os registros: quem lançou (NOME, pedido de
// 31/08/2026, com o e-mail junto porque é o que identifica a conta) e quando.
async function camposDeAutoria(autor: string, criadoEm: Date, atualizadoEm: Date, excluidoEm: Date | null) {
  const nome = await nomeDeAutor(autor);
  return [
    { rotulo: "Registrado por", valor: nome ? `${nome} (${autor})` : autor },
    { rotulo: "Registrado em", valor: dataHora(criadoEm) },
    { rotulo: "Última alteração", valor: dataHora(atualizadoEm) },
    ...(excluidoEm ? [{ rotulo: "Excluído em", valor: dataHora(excluidoEm) }] : []),
  ];
}

/** Nome do arquivo baixado — o gestor arquiva vários, então precisa se distinguir sozinho. */
export function nomeDoArquivo(tipo: TipoComprovante, id: string): string {
  return `comprovante-${tipo}-${id.slice(-6)}.pdf`;
}
