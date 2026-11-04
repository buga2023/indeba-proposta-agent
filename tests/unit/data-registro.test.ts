import { describe, it, expect } from "vitest";
import {
  erroAnoDaData,
  limitesDataVigente,
  DataRegistro,
  RelatorioProspeccaoCreate,
  RelatorioProspeccaoUpdate,
  RelatorioProspeccaoUpdateGestor,
  VisitaCarteiraCreate,
  VisitaCarteiraUpdate,
  VisitaCarteiraUpdateGestor,
} from "@/lib/contracts";

/**
 * Áudio do Mateus, 03/11/2026: alguém lançou "0026" como ano. O ano da data tem que ser o
 * vigente; dia e mês ficam livres. E o gestor passa a poder corrigir a data na edição.
 */
const ANO = new Date().getFullYear();
const hoje = new Date(2026, 9, 15); // 15/10/2026 — relógio injetado nos testes da função pura

describe("erroAnoDaData", () => {
  it("aceita qualquer dia e mês do ano vigente", () => {
    expect(erroAnoDaData("2026-01-01", hoje)).toBeNull();
    expect(erroAnoDaData("2026-09-30", hoje)).toBeNull(); // relatório de setembro lançado em outubro
    expect(erroAnoDaData("2026-12-31", hoje)).toBeNull();
  });
  it("recusa o '0026' que entrou no sistema, e o ano anterior", () => {
    expect(erroAnoDaData("0026-10-20", hoje)).toMatch(/ano da data tem que ser 2026/);
    expect(erroAnoDaData("2025-10-20", hoje)).toMatch(/veio 2025/);
    expect(erroAnoDaData("2027-01-01", hoje)).not.toBeNull();
  });
  it("formato errado também é erro", () => {
    expect(erroAnoDaData("20/10/2026", hoje)).toBe("data no formato AAAA-MM-DD");
  });
  it("limites do <input type=date> cobrem o ano inteiro", () => {
    expect(limitesDataVigente(hoje)).toEqual({ min: "2026-01-01", max: "2026-12-31" });
  });
});

describe("contratos com DataRegistro (relógio real)", () => {
  const prosp = { horario: "10:00", empresa: "Lavanderia X", contato: "Fulano" };
  const visita = { horario: "09:00", cliente: "Hotel Y", quemRecebeu: "Sicrana" };

  it("cadastro aceita o ano vigente e recusa 0026", () => {
    expect(DataRegistro.safeParse(`${ANO}-03-05`).success).toBe(true);
    expect(DataRegistro.safeParse("0026-10-20").success).toBe(false);
    expect(RelatorioProspeccaoCreate.safeParse({ ...prosp, data: "0026-10-20" }).success).toBe(false);
    expect(RelatorioProspeccaoCreate.safeParse({ ...prosp, data: `${ANO}-10-20` }).success).toBe(true);
    expect(VisitaCarteiraCreate.safeParse({ ...visita, data: "0026-10-20" }).success).toBe(false);
    expect(VisitaCarteiraCreate.safeParse({ ...visita, data: `${ANO}-10-20` }).success).toBe(true);
  });

  it("vendedor: a data mandada no update é descartada (a data não muda — 25/08/2026)", () => {
    const r = RelatorioProspeccaoUpdate.safeParse({ ...prosp, data: `${ANO}-01-01` });
    expect(r.success).toBe(true);
    expect(r.success && "data" in r.data).toBe(false);
    const v = VisitaCarteiraUpdate.safeParse({ ...visita, data: `${ANO}-01-01` });
    expect(v.success && "data" in v.data).toBe(false);
  });

  it("gestor: a data entra no update, ainda travada no ano vigente", () => {
    const ok = RelatorioProspeccaoUpdateGestor.safeParse({ ...prosp, data: `${ANO}-02-02` });
    expect(ok.success && ok.data.data).toBe(`${ANO}-02-02`);
    expect(RelatorioProspeccaoUpdateGestor.safeParse({ ...prosp, data: "0026-02-02" }).success).toBe(false);
    // Sem data é edição comum: o Prisma não toca na coluna.
    expect(RelatorioProspeccaoUpdateGestor.safeParse(prosp).success).toBe(true);
    const v = VisitaCarteiraUpdateGestor.safeParse({ ...visita, data: `${ANO}-02-02` });
    expect(v.success && v.data.data).toBe(`${ANO}-02-02`);
    expect(VisitaCarteiraUpdateGestor.safeParse({ ...visita, data: "2025-02-02" }).success).toBe(false);
  });
});
