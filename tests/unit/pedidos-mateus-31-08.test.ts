import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Os quatro pedidos do Mateus de 31/08/2026 (áudios de 09:32 e 15:03):
 *  1. mostrar o NOME de quem lançou, não o e-mail;
 *  2. "análise de produtos químicos" e "outras solicitações" nos tipos de solicitação;
 *  3. avisar os ADMs de solicitação nova (íconezinho + e-mail automático);
 *  4. comprovante em PDF de cada registro, "com a foto, com tudo que foi registrado".
 *
 * O que cada teste guarda é a REGRA, não a implementação: escopo por autor, o aviso que
 * não pode derrubar o registro, e o enum que só cresce.
 */

// `vi.hoisted` porque as fábricas de `vi.mock` sobem para o topo do arquivo: sem isso os
// mocks ainda não existem quando o módulo mockado é carregado.
const { usuario, solicitacao, config, anexo, prospeccao, sendMail } = vi.hoisted(() => ({
  usuario: { findMany: vi.fn() },
  solicitacao: { count: vi.fn(), findFirst: vi.fn() },
  config: { findUnique: vi.fn(), upsert: vi.fn() },
  anexo: { findMany: vi.fn() },
  prospeccao: { findFirst: vi.fn() },
  sendMail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    usuario,
    solicitacaoComercial: solicitacao,
    config,
    anexo,
    relatorioProspeccao: prospeccao,
    contratoComodato: { findFirst: vi.fn() },
    estoqueComodato: { findFirst: vi.fn() },
    visitaCarteira: { findFirst: vi.fn() },
  },
}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

import { autorLabel } from "@/lib/utils";
import { TipoSolicitacaoComercial } from "@/lib/contracts";
import { contarNovasSolicitacoes, avisarAdminsDeSolicitacao } from "@/lib/notificacoes";
import { montarComprovante } from "@/lib/comprovantes";

const gestor = { email: "mateus@indeba.example", papel: "admin" as const };
const vendedor = { email: "joao@indeba.example", papel: "user" as const };

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "ADMIN_EMAILS"]) delete process.env[k];
});

describe("1. nome de quem lançou, não o e-mail", () => {
  it("usa o nome quando ele foi resolvido na leitura", () => {
    expect(autorLabel({ autorNome: "João da Silva", autor: "joao@indeba.example" })).toBe("João da Silva");
  });

  it("cai no e-mail quando a conta não está mais no cadastro — nunca fica em branco", () => {
    expect(autorLabel({ autorNome: null, autor: "joao@indeba.example" })).toBe("joao@indeba.example");
    expect(autorLabel({ autorNome: "   ", autor: "joao@indeba.example" })).toBe("joao@indeba.example");
    expect(autorLabel({ autor: "joao@indeba.example" })).toBe("joao@indeba.example");
  });
});

describe("2. novos tipos de solicitação comercial", () => {
  it("aceita os dois tipos pedidos no áudio", () => {
    expect(TipoSolicitacaoComercial.safeParse("analise_produtos_quimicos").success).toBe(true);
    expect(TipoSolicitacaoComercial.safeParse("outras_solicitacoes").success).toBe(true);
  });

  it("mantém os três tipos antigos — o enum só cresce, senão o registro já gravado fica órfão", () => {
    for (const t of ["analise_agua_tecidos", "visita_setor_tecnico", "amostra_demonstracao"]) {
      expect(TipoSolicitacaoComercial.safeParse(t).success).toBe(true);
    }
  });
});

describe("3. aviso de solicitação nova aos ADMs", () => {
  it("conta só o que o gestor ainda não viu e não foi ele quem lançou", async () => {
    config.findUnique.mockResolvedValue({ valor: "2026-08-31T12:00:00.000Z" });
    solicitacao.count.mockResolvedValue(3);
    expect(await contarNovasSolicitacoes(gestor)).toBe(3);
    const where = solicitacao.count.mock.calls[0][0].where;
    expect(where.autor).toEqual({ not: gestor.email });
    expect(where.excluidoEm).toBeNull();
    expect(where.criadoEm.gt.toISOString()).toBe("2026-08-31T12:00:00.000Z");
  });

  it("sem carimbo de visto, tudo que é dos outros conta como novo", async () => {
    config.findUnique.mockResolvedValue(null);
    solicitacao.count.mockResolvedValue(7);
    expect(await contarNovasSolicitacoes(gestor)).toBe(7);
    expect(solicitacao.count.mock.calls[0][0].where.criadoEm).toBeUndefined();
  });

  it("quem não é gestor não recebe selo — nem chega a consultar o banco", async () => {
    expect(await contarNovasSolicitacoes(vendedor)).toBe(0);
    expect(solicitacao.count).not.toHaveBeenCalled();
  });

  it("banco fora do ar: selo some, não estoura", async () => {
    config.findUnique.mockRejectedValue(new Error("sem banco"));
    expect(await contarNovasSolicitacoes(gestor)).toBe(0);
  });

  it("sem SMTP configurado o aviso é só o ícone — e não tenta enviar", async () => {
    await avisarAdminsDeSolicitacao({ autor: vendedor.email, tipo: "outras_solicitacoes", cliente: "ACME" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("com SMTP, escreve para todos os ADMs menos quem lançou", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.x", SMTP_USER: "u@x", SMTP_PASS: "p" });
    process.env.ADMIN_EMAILS = "diretoria@indeba.example";
    usuario.findMany.mockResolvedValue([{ email: gestor.email }, { email: vendedor.email }]);
    await avisarAdminsDeSolicitacao({ autor: vendedor.email, autorNome: "João", tipo: "amostra_demonstracao", cliente: "ACME" });
    const destinos = sendMail.mock.calls[0][0].to;
    expect(destinos).toContain(gestor.email);
    expect(destinos).toContain("diretoria@indeba.example");
    expect(destinos).not.toContain(vendedor.email);
  });

  it("falha de envio NÃO propaga — o registro do vendedor já está salvo", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.x", SMTP_USER: "u@x", SMTP_PASS: "p" });
    usuario.findMany.mockResolvedValue([{ email: gestor.email }]);
    sendMail.mockRejectedValue(new Error("caixa recusou"));
    await expect(
      avisarAdminsDeSolicitacao({ autor: vendedor.email, tipo: "visita_setor_tecnico", cliente: "ACME" }),
    ).resolves.toBeUndefined();
  });
});

describe("4. comprovante em PDF do registro", () => {
  it("vendedor só tira comprovante do que é dele (escopo por autor na consulta)", async () => {
    solicitacao.findFirst.mockResolvedValue(null);
    expect(await montarComprovante(vendedor, "solicitacao", "abc")).toBeNull();
    expect(solicitacao.findFirst.mock.calls[0][0].where).toEqual({ id: "abc", autor: vendedor.email });
  });

  it("gestor tira de qualquer registro — consulta sem recorte por autor", async () => {
    solicitacao.findFirst.mockResolvedValue(null);
    await montarComprovante(gestor, "solicitacao", "abc");
    expect(solicitacao.findFirst.mock.calls[0][0].where).toEqual({ id: "abc" });
  });

  it("traz tudo o que foi registrado, com o tipo em português e a foto embutida", async () => {
    solicitacao.findFirst.mockResolvedValue({
      id: "sol-1",
      tipo: "analise_produtos_quimicos",
      cliente: "ACME Lavanderia",
      observacao: "Coletar amostra na segunda",
      status: "pendente",
      autor: vendedor.email,
      criadoEm: new Date("2026-08-31T10:00:00Z"),
      atualizadoEm: new Date("2026-08-31T10:00:00Z"),
      excluidoEm: null,
    });
    usuario.findMany.mockResolvedValue([{ email: vendedor.email, nome: "João da Silva" }]);
    anexo.findMany.mockResolvedValue([
      { categoria: "foto", mime: "image/jpeg", bytes: Buffer.from("foto"), nome: "fachada.jpg" },
      { categoria: "documento", mime: "application/pdf", bytes: Buffer.from("doc"), nome: "orcamento.pdf" },
    ]);

    const doc = await montarComprovante(gestor, "solicitacao", "sol-1");
    expect(doc).not.toBeNull();
    const valores = doc!.campos.map((c) => c.valor);
    expect(valores).toContain("ACME Lavanderia");
    expect(valores).toContain("Análise de produtos químicos"); // rótulo legível, não o enum
    expect(valores).toContain("Pendente");
    // Pedido 1 alcança o PDF: o nome aparece, com o e-mail junto para identificar a conta.
    expect(valores).toContain(`João da Silva (${vendedor.email})`);
    expect(doc!.textos[0].valor).toBe("Coletar amostra na segunda");
    // A foto viaja embutida (o PDF é gerado sem acesso à rede); o documento só listado.
    expect(doc!.fotos[0].startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(doc!.documentos).toEqual(["orcamento.pdf"]);
  });

  it("registro excluído continua imprimível, com a data da exclusão no documento", async () => {
    prospeccao.findFirst.mockResolvedValue({
      id: "pro-1",
      data: "2026-08-20",
      horario: "14:30",
      empresa: "ACME",
      contato: "Maria",
      telefone: null,
      observacao: null,
      autor: vendedor.email,
      criadoEm: new Date("2026-08-20T14:30:00Z"),
      atualizadoEm: new Date("2026-08-20T14:30:00Z"),
      excluidoEm: new Date("2026-08-25T09:00:00Z"),
    });
    usuario.findMany.mockResolvedValue([]);
    anexo.findMany.mockResolvedValue([]);

    const doc = await montarComprovante(gestor, "prospeccao", "pro-1");
    expect(doc!.campos.some((c) => c.rotulo === "Excluído em")).toBe(true);
    // Sem nome no cadastro, o comprovante mostra o e-mail — nunca fica em branco.
    expect(doc!.campos.find((c) => c.rotulo === "Registrado por")!.valor).toBe(vendedor.email);
  });
});
