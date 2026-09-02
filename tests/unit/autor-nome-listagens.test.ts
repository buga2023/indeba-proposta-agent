import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O nome de quem lançou tem que sair RESOLVIDO de toda listagem (áudio do Mateus,
 * 31/08 e 02/09/2026). A tela cai no e-mail quando `autorNome` vem null, e foi
 * exatamente o que aconteceu em produção: o contrato declarava o campo, a tela já lia
 * `autorNome ?? autor`, mas quatro listagens (visitas, contratos, estoque e chamados)
 * nunca consultavam o cadastro — nenhum teste olhava para isso.
 *
 * Este teste é do CONTRATO DE LEITURA, não de uma tela: qualquer listagem nova que
 * esqueça de resolver o nome cai aqui.
 */

const findMany = vi.fn();
const usuarioFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    visitaCarteira: { findMany: (...a: unknown[]) => findMany(...a) },
    contratoComodato: { findMany: (...a: unknown[]) => findMany(...a) },
    estoqueComodato: { findMany: (...a: unknown[]) => findMany(...a) },
    chamado: { findMany: (...a: unknown[]) => findMany(...a) },
    usuario: { findMany: (...a: unknown[]) => usuarioFindMany(...a) },
  },
}));
vi.mock("@/lib/anexos", () => ({ anexosDe: async () => new Map() }));

import { listarVisitas, listarContratosComodato, listarEstoqueComodato } from "@/lib/ferramentas-tecnicas";
import { listarChamados } from "@/lib/chamados";

const GESTOR = { email: "mateus@indeba.com", nome: "Mateus", papel: "admin" as const };
const datas = { criadoEm: new Date("2026-09-01"), atualizadoEm: new Date("2026-09-01") };

beforeEach(() => {
  findMany.mockReset();
  usuarioFindMany.mockReset();
  // O cadastro conhece o autor: toda listagem tem que trocar o e-mail pelo nome.
  usuarioFindMany.mockResolvedValue([{ email: "gerencia@indebaexpress.com.br", nome: "Mateus Maristane Resende" }]);
});

const AUTOR = "gerencia@indebaexpress.com.br";
const NOME = "Mateus Maristane Resende";

describe("listagens resolvem o nome do autor", () => {
  it("visitas de rotina", async () => {
    findMany.mockResolvedValue([
      { id: "v1", data: "2026-08-31", horario: "10:30", cliente: "FBC", quemRecebeu: "Sr. Carlos", telefone: null, area: "tecnica", status: "resolvido", observacao: null, autor: AUTOR, fotos: [], documentoMime: null, documentoNome: null, ...datas },
    ]);
    const [v] = await listarVisitas(GESTOR, "tecnica");
    expect(v.autorNome).toBe(NOME);
  });

  it("contratos de comodato", async () => {
    findMany.mockResolvedValue([{ id: "c1", cliente: "FBC", comodatos: "", observacoes: null, contratoMime: null, autor: AUTOR, ...datas }]);
    const [c] = await listarContratosComodato(GESTOR);
    expect(c.autorNome).toBe(NOME);
  });

  it("estoque de comodatos", async () => {
    findMany.mockResolvedValue([{ id: "e1", codigo: "X1", peca: "Bomba", quantidade: 2, obs: null, autor: AUTOR, ...datas }]);
    const [e] = await listarEstoqueComodato(GESTOR);
    expect(e.autorNome).toBe(NOME);
  });

  it("chamados", async () => {
    findMany.mockResolvedValue([
      { id: "ch1", titulo: "T", descricao: "D", categoria: "bug", prioridade: "media", status: "aberto", respostaGestor: null, autor: AUTOR, ...datas },
    ]);
    const [ch] = await listarChamados(GESTOR);
    expect(ch.autorNome).toBe(NOME);
  });

  it("conta removida do cadastro: cai no e-mail, sem quebrar a lista", async () => {
    usuarioFindMany.mockResolvedValue([]);
    findMany.mockResolvedValue([
      { id: "v1", data: "2026-08-31", horario: "10:30", cliente: "FBC", quemRecebeu: "Sr. Carlos", telefone: null, area: "tecnica", status: "resolvido", observacao: null, autor: AUTOR, fotos: [], documentoMime: null, documentoNome: null, ...datas },
    ]);
    const [v] = await listarVisitas(GESTOR, "tecnica");
    expect(v.autorNome).toBeNull();
    expect(v.autor).toBe(AUTOR);
  });
});
