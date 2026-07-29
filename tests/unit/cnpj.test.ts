import { describe, it, expect } from "vitest";
import { mascaraCnpj, cnpjValido, erroCnpj, soDigitos } from "@/lib/cnpj";

// QA (jul/2026): o campo aceitava "abc123xyz!@#" sem formatar nem alertar, e o lixo ia
// parar na capa do PDF entregue ao cliente.
describe("máscara de CNPJ", () => {
  it("formata progressivamente enquanto digita", () => {
    expect(mascaraCnpj("12")).toBe("12");
    expect(mascaraCnpj("12345")).toBe("12.345");
    expect(mascaraCnpj("12345678")).toBe("12.345.678");
    expect(mascaraCnpj("123456780001")).toBe("12.345.678/0001");
    expect(mascaraCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("descarta letras e símbolos, e não passa de 14 dígitos", () => {
    expect(soDigitos("abc123xyz!@#")).toBe("123");
    expect(mascaraCnpj("abc123xyz!@#")).toBe("12.3"); // sobra só o dígito, já pontuado
    expect(soDigitos("1234567800019512345")).toHaveLength(14);
  });

  it("aceita entrada já formatada sem duplicar pontuação", () => {
    expect(mascaraCnpj("12.345.678/0001-95")).toBe("12.345.678/0001-95");
  });
});

describe("validação de CNPJ", () => {
  it("aceita CNPJ com dígitos verificadores corretos", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("recusa DV errado, tamanho errado e sequência repetida", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false); // último DV trocado
    expect(cnpjValido("11222333000")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false); // passa no módulo 11, não existe
    expect(cnpjValido("11111111111111")).toBe(false);
  });
});

describe("erroCnpj — mensagem do campo", () => {
  it("vazio não é erro: CNPJ é opcional no contrato", () => {
    expect(erroCnpj("")).toBeNull();
    expect(erroCnpj("   ")).toBeNull();
  });

  it("avisa quando falta dígito e quando o DV não fecha", () => {
    expect(erroCnpj("112223330001")).toMatch(/incompleto — 12 de 14/);
    expect(erroCnpj("11.222.333/0001-82")).toMatch(/inválido/);
  });

  it("não reclama de CNPJ válido", () => {
    expect(erroCnpj("11.222.333/0001-81")).toBeNull();
  });
});
