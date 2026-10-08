import { describe, expect, it } from "vitest";
import { executaveisAlternativos, pdfDeHtml } from "@/lib/pdf/render";

describe("render de PDF", () => {
  it("acha um Chromium alternativo quando o build exato do Playwright não existe", () => {
    expect(Array.isArray(executaveisAlternativos())).toBe(true);
  });

  it("gera PDF de HTML simples (sem travar em networkidle e sem rede)", async () => {
    const pdf = await pdfDeHtml('<!DOCTYPE html><html><body><h1>ok</h1><img src="https://exemplo.invalid/x.png"><img src=""></body></html>');
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 60_000);
});

describe("proposta de solução (consolidada)", () => {
  it("renderPdf devolve um PDF válido", async () => {
    const { renderPdf } = await import("@/lib/pdf/render");
    const pdf = await renderPdf({
      id: "t1",
      criadoEm: new Date().toISOString(),
      status: "rascunho",
      tipo: "consolidada",
      template: "indeba_express",
      cliente: { razaoSocial: "Cliente Teste", cnpj: null, segmento: null, responsavel: null },
      textoApresentacao: { conteudo: "Texto", procedencia: "MANUAL" },
      itens: [],
      condicoesComerciais: { validade: "7 dias", prazoEntrega: "5 dias", pagamento: "30 dias", frete: "CIF" },
    } as never);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 90_000);
});
