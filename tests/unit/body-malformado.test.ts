import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

// Mocks só das dependências pesadas/externas — o foco é o TRATAMENTO DO BODY na rota.
vi.mock("@/lib/pdf/render", () => ({ renderPdf: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { proposta: { upsert: vi.fn() } } }));
vi.mock("@/lib/log", () => ({ eventoDe: vi.fn(), registrarProposta: vi.fn() }));

import { POST as postPdf } from "@/app/api/pdf/route";
import { POST as postPropostas } from "@/app/api/propostas/route";
import { POST as postMontarEstruturado } from "@/app/api/montar-estruturado/route";

// `await req.json()` LANÇA quando o corpo é vazio ou não é JSON válido. Nas rotas essa
// chamada ficava fora de qualquer try/catch, então o erro subia e o cliente recebia um
// 500 opaco — sem saber que o problema era o próprio payload que ele mandou. Body ruim
// é erro do cliente: tem que ser 400, igual ao que já acontece com body bem-formado mas
// fora do contrato. Guardião do idioma `req.json().catch(() => null)` nas 27 rotas.
const reqRuim = () =>
  ({
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
    cookies: { get: () => undefined },
  }) as unknown as NextRequest;

describe("body malformado → 400, nunca 500", () => {
  it("POST /api/pdf", async () => {
    const r = await postPdf(reqRuim());
    expect(r.status).toBe(400);
  });

  it("POST /api/propostas", async () => {
    const r = await postPropostas(reqRuim());
    expect(r.status).toBe(400);
  });

  it("POST /api/montar-estruturado", async () => {
    const r = await postMontarEstruturado(reqRuim());
    expect(r.status).toBe(400);
  });
});
