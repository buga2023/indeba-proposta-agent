import { describe, it, expect } from "vitest";
import { ReferenciaItem, SyncReferenciasRequest, PerfilEstilo } from "@/lib/contracts";
import { montarImagemPrompt } from "@/lib/llm/gerar-instagram";

// Referências de estilo: o perfil derivado (procedência IA-TEXTO) é "tempero" — substitui
// o estilo visual fixo e some graciosamente quando ausente (constituição §1 e §5).
describe("contrato de referências", () => {
  it("ReferenciaItem aceita só imagem, ou só legenda", () => {
    expect(ReferenciaItem.safeParse({ nomeArquivo: "a.jpg", imagemBase64: "QUJD" }).success).toBe(true);
    expect(ReferenciaItem.safeParse({ nomeArquivo: "a.txt", legenda: "oi" }).success).toBe(true);
  });

  it("ReferenciaItem sem imagem E sem legenda é rejeitado (não há o que aprender)", () => {
    expect(ReferenciaItem.safeParse({ nomeArquivo: "vazio.bin" }).success).toBe(false);
  });

  it("SyncReferenciasRequest exige ao menos 1 item", () => {
    expect(SyncReferenciasRequest.safeParse({ itens: [] }).success).toBe(false);
    expect(
      SyncReferenciasRequest.safeParse({ itens: [{ nomeArquivo: "a.jpg", imagemBase64: "QUJD" }] }).success,
    ).toBe(true);
  });

  it("PerfilEstilo inválido (sem descritor) é rejeitado na leitura", () => {
    expect(PerfilEstilo.safeParse({ exemplosLegenda: [], fontes: [], atualizadoEm: "x" }).success).toBe(false);
  });
});

describe("montarImagemPrompt — estilo derivado substitui o fixo", () => {
  const cena = "a man wiping a staircase, medium shot";

  it("GUARDIÃO: o estilo derivado das referências entra no prompt da imagem", () => {
    const estiloDerivado = "moody warm golden-hour light, muted earthy palette, tight close framing";
    const out = montarImagemPrompt(cena, estiloDerivado);
    expect(out).toContain(estiloDerivado);
    expect(out).toContain(cena);
  });

  it("sem perfil (estilo padrão) → usa a assinatura azul Indeba (degradação graciosa)", () => {
    const out = montarImagemPrompt(cena);
    expect(out).toContain("soft natural blue tones"); // ESTILO_INDEBA
  });

  it("remove negações/proporção que o modelo possa ter duplicado na cena", () => {
    const out = montarImagemPrompt(`${cena}, vertical 4:5, no logos`, "X palette");
    expect(out).not.toMatch(/vertical 4:5.*X palette/);
    expect(out.endsWith("X palette")).toBe(true);
  });
});
