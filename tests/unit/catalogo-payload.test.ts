import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/catalogo/route";
import { carregarCatalogo } from "@/lib/catalogo";

const req = (headers: Record<string, string> = {}) =>
  ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as NextRequest;

// A ficha rica é do PDF, e o PDF é montado no SERVIDOR (montar.ts copia do catálogo pro
// PropostaScope). O cliente só usa titulo/descricao. Este guardião existe pra que a ficha
// completa não volte a viajar pela rede sem necessidade — eram 104 KB por request.
describe("GET /api/catalogo — payload enxuto", () => {
  it("entrega a ficha só com titulo e descricao", async () => {
    const body = await (await GET(req())).json();
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
    const body = await (await GET(req())).json();
    const servidor = carregarCatalogo();
    expect(body.produtos.length).toBe(servidor.produtos.length);
    expect(body.produtos[0].embalagens).toEqual(servidor.produtos[0].embalagens);
  });
});

// A 1ª versão usava `max-age=300` e isso entregou catálogo velho logo depois de um deploy:
// o produto corrigido não aparecia por 5 minutos. Com ETag o browser sempre revalida, e
// quando nada mudou a resposta é um 304 vazio — mesma economia, sem servir dado obsoleto.
describe("GET /api/catalogo — revalidação por ETag", () => {
  it("responde com ETag e sem cache por tempo", async () => {
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(r.headers.get("ETag")).toBeTruthy();
    expect(r.headers.get("Cache-Control")).toContain("no-cache");
    expect(r.headers.get("Cache-Control")).toContain("private"); // nunca em CDN compartilhada
    expect(r.headers.get("Cache-Control")).not.toMatch(/max-age=[1-9]/);
  });

  it("com If-None-Match igual, devolve 304 sem corpo", async () => {
    const etag = (await GET(req())).headers.get("ETag")!;
    const r = await GET(req({ "if-none-match": etag }));
    expect(r.status).toBe(304);
    expect(await r.text()).toBe("");
  });

  it("com If-None-Match diferente, devolve o catálogo inteiro", async () => {
    const r = await GET(req({ "if-none-match": '"outra-coisa"' }));
    expect(r.status).toBe(200);
    expect((await r.json()).produtos.length).toBeGreaterThan(0);
  });
});
