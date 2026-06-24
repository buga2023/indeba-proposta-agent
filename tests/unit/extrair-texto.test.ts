import { describe, it, expect } from "vitest";
import { extrairTextoContrato, formatoDe } from "@/lib/contrato/extrair-texto";

const enc = (s: string) => new TextEncoder().encode(s);

describe("extrair-texto: anexo de contrato (PDF/DOCX/TXT)", () => {
  it("detecta o formato pela extensão (case-insensitive)", () => {
    expect(formatoDe("contrato.PDF")).toBe("pdf");
    expect(formatoDe("acordo.docx")).toBe("docx");
    expect(formatoDe("minuta.txt")).toBe("txt");
    expect(formatoDe("foto.jpg")).toBeNull();
    expect(formatoDe("semext")).toBeNull();
  });

  it("TXT: extrai o conteúdo exato (sem IA no caminho)", async () => {
    const conteudo = "CLÁUSULA 1ª — Multa de 10% sobre o saldo. Foro: Salvador/BA.";
    expect(await extrairTextoContrato(enc(conteudo), "contrato.txt")).toBe(conteudo);
  });

  it("normaliza CRLF e espaços antes de quebra", async () => {
    const t = await extrairTextoContrato(enc("linha 1 \r\nlinha 2\r\n"), "a.txt");
    expect(t).toBe("linha 1\nlinha 2");
  });

  it("formato não suportado → erro claro", async () => {
    await expect(extrairTextoContrato(enc("x"), "contrato.jpg")).rejects.toThrow(/não suportado/i);
  });

  it("arquivo vazio → erro (não retorna string vazia silenciosa)", async () => {
    await expect(extrairTextoContrato(enc("   \n  "), "vazio.txt")).rejects.toThrow();
  });
});
