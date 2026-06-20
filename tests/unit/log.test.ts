import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registrarProposta, eventoDe, arquivoLog } from "@/lib/log";
import type { PropostaScope } from "@/lib/contracts";

const dir = join(tmpdir(), "agente-log-test");

beforeAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL; // garante modo arquivo (sem Redis)
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.PDF_OUT_DIR = dir;
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const scope = {
  id: "abc-123",
  cliente: { razaoSocial: "GVA Alimentos", cnpj: null, segmento: null },
  itens: [
    {
      codigo: "PRIMMAX-PLUS",
      nome: "Primmax Plus",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: null, custoDiluido: null }],
    },
  ],
} as unknown as PropostaScope;

describe("log append-only de propostas (§1.8 / OWASP A09)", () => {
  it("anexa cada proposta como linha JSONL e acumula (não reescreve)", async () => {
    await registrarProposta(eventoDe(scope, "mateus"));
    await registrarProposta(eventoDe(scope, "gustavo"));

    const linhas = readFileSync(arquivoLog(), "utf-8").trim().split("\n");
    expect(linhas.length).toBe(2); // append-only: 2 registros

    const e1 = JSON.parse(linhas[0]);
    expect(e1.usuario).toBe("mateus");
    expect(e1.cliente).toBe("GVA Alimentos");
    expect(e1.itens[0].precos).toEqual(["130.00"]); // preço aplicado, do catálogo
    expect(typeof e1.ts).toBe("string");

    expect(JSON.parse(linhas[1]).usuario).toBe("gustavo");
  });
});
