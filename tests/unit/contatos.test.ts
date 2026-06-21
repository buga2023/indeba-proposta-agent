import { describe, it, expect } from "vitest";
import { minerarContatos } from "@/lib/prospeccao/contatos";

describe("minerarContatos — extração determinística de contatos da web", () => {
  it("extrai e-mail e ignora lixo de asset/placeholder", () => {
    const txt = "Fale com vendas@empresa.com.br. logo@2x.png seu@email.com noreply@example.com";
    const { emails } = minerarContatos(txt);
    expect(emails).toContain("vendas@empresa.com.br");
    expect(emails).not.toContain("logo@2x.png");
    expect(emails.some((e) => e.includes("example.com"))).toBe(false);
  });

  it("extrai telefone BR válido e descarta sequências curtas/triviais", () => {
    const { telefones } = minerarContatos("Ligue (71) 99888-7766 ou 0000-0000");
    expect(telefones.some((t) => t.replace(/\D/g, "").endsWith("998887766"))).toBe(true);
    expect(telefones.some((t) => t.replace(/\D/g, "") === "00000000")).toBe(false);
  });

  it("captura perfis de redes sociais e ignora caminhos genéricos (posts/feed)", () => {
    const txt =
      "https://instagram.com/empresax https://instagram.com/p/abc123 " +
      "https://linkedin.com/company/empresa-x https://linkedin.com/feed/ " +
      "https://wa.me/5571999887766";
    const { redes } = minerarContatos(txt);
    expect(redes.instagram).toContain("https://instagram.com/empresax");
    expect(redes.instagram).not.toContain("https://instagram.com/p/abc123");
    expect(redes.linkedin).toContain("https://linkedin.com/company/empresa-x");
    expect(redes.linkedin.some((u) => u.includes("/feed"))).toBe(false);
    expect(redes.whatsapp.length).toBe(1);
  });

  it("texto vazio → tudo vazio (sem inventar)", () => {
    const c = minerarContatos("");
    expect(c.emails).toEqual([]);
    expect(c.telefones).toEqual([]);
    expect(c.redes.linkedin).toEqual([]);
  });
});
