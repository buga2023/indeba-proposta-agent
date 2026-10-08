import { describe, expect, it } from "vitest";
import { FILTRO_VAZIO, filtrarPropostas, filtroAtivo } from "@/lib/filtrar-propostas";

const agora = new Date(2026, 9, 8, 12); // 08/10/2026
const mk = (cliente: string, status: string, atualizadoEm: string, autorNome: string | null = "Mateus") => ({
  cliente, status, atualizadoEm, autor: "m@x.com", autorNome,
});
const lista = [
  mk("Usina São João", "aprovada", "2026-10-02T10:00:00"),
  mk("Frigorífico Açaí", "enviada", "2026-09-20T10:00:00", "Ana"),
  mk("Laticínio Sul", "recusada", "2025-03-10T10:00:00"),
];

describe("filtrarPropostas", () => {
  it("filtro vazio devolve tudo e lista vazia não quebra", () => {
    expect(filtrarPropostas(lista, FILTRO_VAZIO, agora)).toHaveLength(3);
    expect(filtrarPropostas([], FILTRO_VAZIO, agora)).toEqual([]);
    expect(filtroAtivo(FILTRO_VAZIO)).toBe(false);
  });
  it("termo ignora acento e caixa, e casa consultor", () => {
    expect(filtrarPropostas(lista, { ...FILTRO_VAZIO, termo: "acai" }, agora)).toHaveLength(1);
    expect(filtrarPropostas(lista, { ...FILTRO_VAZIO, termo: "ana" }, agora)[0].cliente).toBe("Frigorífico Açaí");
  });
  it("período e status", () => {
    expect(filtrarPropostas(lista, { ...FILTRO_VAZIO, periodo: "mes" }, agora)).toHaveLength(1);
    expect(filtrarPropostas(lista, { ...FILTRO_VAZIO, periodo: "30d" }, agora)).toHaveLength(2);
    expect(filtrarPropostas(lista, { ...FILTRO_VAZIO, periodo: "ano" }, agora)).toHaveLength(2);
    expect(filtrarPropostas(lista, { ...FILTRO_VAZIO, status: "recusada" }, agora)).toHaveLength(1);
    expect(filtroAtivo({ ...FILTRO_VAZIO, status: "recusada" })).toBe(true);
  });
});
