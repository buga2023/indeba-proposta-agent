import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/catalogo/route";
import { carregarCatalogo } from "@/lib/catalogo";

// A ficha rica é do PDF, e o PDF é montado no SERVIDOR (montar.ts copia do catálogo pro
// PropostaScope). O cliente só usa titulo/descricao. Este guardião existe pra que a ficha
// completa não volte a viajar pela rede sem necessidade — eram 104 KB por request.
describe("GET /api/catalogo — payload enxuto", () => {
  it("entrega a ficha só com titulo e descricao", async () => {
    const body = await (await GET()).json();
    const comFicha = body.produtos.filter((p: { ficha: unknown }) => p.ficha);
    expect(comFicha.length).toBeGreaterThan(0);

    for (const p of comFicha) {
      expect(Object.keys(p.ficha).sort()).toEqual(["descricao", "titulo"]);
    }
  });

  it("mas o catálogo do SERVIDOR mantém a ficha completa (é dela que o PDF vive)", () => {
    const rico = carregarCatalogo().produtos.find((p) => p.ficha?.beneficios?.length);
    expect(rico).toBeDefined();
    expect(rico!.ficha!.beneficios!.length).toBeGreaterThan(0);
  });

  it("não perde produto nem embalagem no recorte", async () => {
    const body = await (await GET()).json();
    const servidor = carregarCatalogo();
    expect(body.produtos.length).toBe(servidor.produtos.length);
    expect(body.produtos[0].embalagens).toEqual(servidor.produtos[0].embalagens);
  });

  it("manda o Cache-Control privado (resposta autenticada não pode ir pra CDN)", async () => {
    const cc = (await GET()).headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toMatch(/max-age=\d+/);
  });
});
