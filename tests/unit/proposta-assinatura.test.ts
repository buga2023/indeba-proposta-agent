import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Quem assina a proposta é o DONO do registro (áudio do Mateus, 16/09/2026: "seleciono o
 * vendedor e no PDF ele mantém meu nome"). Depois de transferir, o "Editar" remontava com o
 * consultor da sessão e o auto-save regravava o scope com o nome do gestor.
 */

const findUniqueProposta = vi.fn();
const findUniqueUsuario = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    proposta: { findUnique: (...a: unknown[]) => findUniqueProposta(...a), upsert: (...a: unknown[]) => upsert(...a) },
    usuario: { findUnique: (...a: unknown[]) => findUniqueUsuario(...a) },
  },
}));
vi.mock("@/lib/catalogo", () => ({ produtoPorCodigoCompleto: vi.fn() }));
vi.mock("@/lib/autores", () => ({ nomeDeAutor: vi.fn(async () => "Austin"), nomesDeAutores: vi.fn(async () => new Map()) }));
vi.mock("@/lib/imagem-produto", () => ({ imagemDaCotada: vi.fn() }));

import { assinarScope, consultorDoDono, salvarProposta } from "@/lib/propostas";
import type { PropostaScope } from "@/lib/contracts";

const AUSTIN = { nome: "Austin", email: "austin@indeba.com", telefone: "71999990000" };

beforeEach(() => {
  for (const m of [findUniqueProposta, findUniqueUsuario, upsert]) m.mockReset();
});

describe("assinarScope — carimba o consultor em todos os lugares do scope", () => {
  it("scope.consultor + capa, fechamento e contato da consolidada", () => {
    const scope: Record<string, unknown> = {
      consultor: { nome: "Mateus", email: "mateus@indeba.com", telefone: null },
      consolidada: {
        capa: { consultor: "Mateus", cidade: "Salvador", subtitulo: "x" },
        condicoes: { consultor: "Mateus", cargo: "Consultor" },
        contato: { whatsapp: null, emailConsultor: "mateus@indeba.com" },
      },
    };
    assinarScope(scope, AUSTIN);
    expect(scope.consultor).toEqual(AUSTIN);
    const c = scope.consolidada as Record<string, Record<string, unknown>>;
    expect(c.capa.consultor).toBe("Austin");
    expect(c.condicoes.consultor).toBe("Austin");
    expect(c.contato).toEqual({ whatsapp: "71999990000", emailConsultor: "austin@indeba.com" });
  });

  it("orçamento/implantação (sem consolidada) só troca scope.consultor", () => {
    const scope: Record<string, unknown> = { consultor: { nome: "Mateus" } };
    assinarScope(scope, AUSTIN);
    expect(scope.consultor).toEqual(AUSTIN);
    expect(scope.consolidada).toBeUndefined();
  });
});

describe("consultorDoDono", () => {
  it("proposta inexistente → null (criação assina com a sessão)", async () => {
    findUniqueProposta.mockResolvedValue(null);
    expect(await consultorDoDono("p-novo")).toBeNull();
    expect(findUniqueUsuario).not.toHaveBeenCalled();
  });

  it("resolve o autor no cadastro", async () => {
    findUniqueProposta.mockResolvedValue({ autor: "austin@indeba.com" });
    findUniqueUsuario.mockResolvedValue({ nome: "Austin", email: "austin@indeba.com", telefone: "71999990000" });
    expect(await consultorDoDono("p-1")).toEqual(AUSTIN);
  });
});

describe("salvarProposta — o auto-save não devolve a assinatura para quem está logado", () => {
  it("proposta transferida para Austin, regravada pelo gestor → scope gravado assinado por Austin", async () => {
    findUniqueProposta.mockResolvedValue({ autor: "austin@indeba.com" });
    findUniqueUsuario.mockResolvedValue({ nome: "Austin", email: "austin@indeba.com", telefone: null });
    upsert.mockImplementation(async ({ update }: { update: { scope: Record<string, unknown> } }) => ({
      id: "p-1", autor: "austin@indeba.com", status: "em_andamento", cliente: "Fábrica de Pães", segmento: null,
      tipo: "orcamento", total: { toFixed: () => "10.00", toString: () => "10" }, qtdItens: 0, criadoEm: new Date(), atualizadoEm: new Date(), scope: update.scope,
    }));
    const scope = {
      id: "p-1", criadoEm: "2026-09-16T00:00:00.000Z", status: "rascunho", tipo: "orcamento", template: "indeba",
      cliente: { razaoSocial: "Fábrica de Pães", cnpj: null, segmento: null },
      textoApresentacao: { conteudo: "t", procedencia: "MANUAL" }, itens: [],
      condicoesComerciais: { validade: "30 dias", prazoEntrega: "5 dias", pagamento: "28ddl", frete: "CIF" },
      consultor: { nome: "Mateus", email: "mateus@indeba.com", telefone: null },
    } as unknown as PropostaScope;
    await salvarProposta(scope, "mateus@indeba.com");
    const gravado = upsert.mock.calls[0][0].update.scope as { consultor: { nome: string } };
    expect(gravado.consultor.nome).toBe("Austin");
  });
});
