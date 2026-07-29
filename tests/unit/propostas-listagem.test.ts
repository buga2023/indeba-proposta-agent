import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mocka só o acesso ao banco — o foco é a RESILIÊNCIA da listagem a linha podre.
const findMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { proposta: { findMany: (a: unknown) => findMany(a) } },
}));

import { listarPropostas } from "@/lib/propostas";

const scope = { itens: [{ codigo: "A1" }, { codigo: "A2" }] };

function linha(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    status: "enviada",
    autor: "mateus",
    cliente: "Frigorífico X",
    segmento: null,
    tipo: "orcamento",
    total: new Prisma.Decimal("150.00"),
    scope,
    criadoEm: new Date("2026-06-24T00:00:00.000Z"),
    atualizadoEm: new Date("2026-06-24T00:00:00.000Z"),
    ...over,
  };
}

beforeEach(() => {
  findMany.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listarPropostas — uma linha ruim não pode derrubar o histórico", () => {
  it("mapeia a listagem normal", async () => {
    findMany.mockResolvedValue([linha(), linha({ id: "p2", status: "rascunho" })]);
    const r = await listarPropostas();
    expect(r.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(r[0].qtdItens).toBe(2);
    expect(r[0].total).toBe("150.00");
  });

  // REGRESSÃO: `Proposta.status` é String livre no banco (sem CHECK). Uma linha com valor
  // fora do enum fazia o PropostaResumo.parse lançar dentro do rows.map e o GET /api/propostas
  // devolvia 500 — o histórico INTEIRO sumia (e sem histórico não dá pra reabrir/editar).
  it("status fora do enum vira 'rascunho' em vez de estourar a lista", async () => {
    findMany.mockResolvedValue([linha({ id: "ruim", status: "gerada" }), linha({ id: "ok" })]);
    const r = await listarPropostas();
    expect(r.map((p) => p.id)).toEqual(["ruim", "ok"]); // a linha ruim CONTINUA visível
    expect(r[0].status).toBe("rascunho");
    expect(r[1].status).toBe("enviada");
  });

  it("linha inválida em outro campo é pulada, o resto da lista sobrevive", async () => {
    findMany.mockResolvedValue([linha({ id: "ruim", tipo: "inexistente" }), linha({ id: "ok" })]);
    const r = await listarPropostas();
    expect(r.map((p) => p.id)).toEqual(["ok"]);
  });
});

// Arquivar é o jeito de tirar proposta da frente sem apagar dado. O corte tem que ser no
// WHERE: filtrar no cliente ainda traria as linhas do banco e pela rede — eram 32 de 39.
describe("listarPropostas — arquivadas fora por padrão", () => {
  it("por padrão pede ao banco só o que não está arquivado", async () => {
    findMany.mockResolvedValue([]);
    await listarPropostas();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { not: "arquivada" } } }),
    );
  });

  it("com incluirArquivadas, não aplica filtro de status", async () => {
    findMany.mockResolvedValue([]);
    await listarPropostas(200, true);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });
});
