import { describe, expect, it } from "vitest";
import { EMPRESA, enderecoCompleto } from "@/lib/empresa";

// Guardião do refactor de 08/10/2026: os PDFs passaram a ler a identidade da empresa de UM
// objeto. O que sai no papel tem de ser byte a byte o que saía antes.
describe("EMPRESA — identidade usada nos PDFs", () => {
  it("rodapé/assinatura continuam iguais ao texto antigo", () => {
    expect(enderecoCompleto()).toBe("Rua Cosme de Farias, 05 — Galpão 01, Boca do Rio, Salvador — BA · CEP 41710-010");
  });
  it("dados fiscais e contato", () => {
    expect(EMPRESA.cnpj).toBe("13.313.568/0001-04");
    expect(EMPRESA.inscricaoEstadual).toBe("150336336");
    expect(EMPRESA.telefone).toBe("(71) 3369-2306");
    expect(EMPRESA.emailGerencia).toBe("gerencia@indebaexpress.com.br");
    expect(`${EMPRESA.cidade} – ${EMPRESA.uf}`).toBe("Salvador – BA");
  });
});
