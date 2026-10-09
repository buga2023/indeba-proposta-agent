import { describe, expect, it } from "vitest";
import { diagnosticarEnv, formatarAvisos } from "@/lib/env-check";

const prod = { producao: true, vercel: true };
const base = {
  AUTH_SESSION_SECRET: "x".repeat(32),
  DATABASE_URL: "postgresql://a:b@c/d",
  UPSTASH_REDIS_REST_URL: "https://u",
  UPSTASH_REDIS_REST_TOKEN: "t",
  INDEBA_WHATSAPP: "71999990000",
  OLLAMA_BASE_URL: "https://ia",
  SITE_URL: "https://indeba-express.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "indeba-express.vercel.app",
};

describe("diagnosticarEnv", () => {
  it("ambiente completo não gera aviso", () => {
    expect(diagnosticarEnv(base, prod)).toEqual([]);
  });

  it("SITE_URL de domínio renomeado (o caso real de 08/10/2026) vira aviso", () => {
    const avisos = diagnosticarEnv({ ...base, SITE_URL: "https://indeba-propostas-agent.vercel.app" }, prod);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].variavel).toBe("SITE_URL");
    expect(avisos[0].texto).toMatch(/não bate com o domínio de produção/);
  });

  it("SITE_URL com caminho ou barra final é erro (vira prefixo de link)", () => {
    expect(diagnosticarEnv({ ...base, SITE_URL: "https://indeba-express.vercel.app/" }, prod)[0].nivel).toBe("erro");
  });

  it("produção sem segredo de sessão e sem banco são erros; sem Upstash é aviso", () => {
    const avisos = diagnosticarEnv({ ...base, AUTH_SESSION_SECRET: "", DATABASE_URL: undefined, UPSTASH_REDIS_REST_TOKEN: "" }, prod);
    expect(avisos.map((a) => `${a.nivel}:${a.variavel}`)).toEqual(["erro:AUTH_SESSION_SECRET", "erro:DATABASE_URL", "aviso:UPSTASH_REDIS_REST_URL"]);
  });

  it("fora de produção só olha SITE_URL", () => {
    expect(diagnosticarEnv({}, { producao: false, vercel: false })).toEqual([
      { nivel: "aviso", variavel: "SITE_URL", texto: expect.stringMatching(/ausente/) },
    ]);
  });

  it("formatarAvisos prefixa [env] e o nível", () => {
    expect(formatarAvisos([{ nivel: "erro", variavel: "X", texto: "y" }])).toEqual(["[env] ERRO X: y"]);
  });
});
