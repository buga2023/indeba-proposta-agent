import { describe, it, expect, beforeAll } from "vitest";
import { validarHash, criarSessao, validarSessao, authAtiva, gerarCredencial, type Usuario } from "@/lib/auth";

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = "segredo-de-teste";
});

const mateus: Usuario = { email: "mateus@indeba.com", nome: "Mateus Résende", papel: "user" };
const admin: Usuario = { email: "admin@indeba.example", nome: "Admin Exemplo", papel: "admin" };

describe("auth — sessão assinada (edge-safe, sem banco)", () => {
  it("auth fica ativa por padrão (AUTH_ENABLED ausente)", () => {
    delete process.env.AUTH_ENABLED;
    expect(authAtiva()).toBe(true);
  });

  it("auth desliga só com AUTH_ENABLED=false explícito", () => {
    process.env.AUTH_ENABLED = "false";
    expect(authAtiva()).toBe(false);
    delete process.env.AUTH_ENABLED;
  });

  it("gerarCredencial/validarHash: aceita a senha correta e rejeita a errada", async () => {
    const credencial = await gerarCredencial("indeba@2026");
    expect(await validarHash("indeba@2026", credencial)).toBe(true);
    expect(await validarHash("errada", credencial)).toBe(false);
  });

  it("validarHash rejeita formato antigo/inesperado (sem salt.hash)", async () => {
    expect(await validarHash("senhaCrua", "semPontoAqui")).toBe(false);
  });

  it("roundtrip: criarSessao → validarSessao devolve email/nome/papel intactos", async () => {
    const cookie = await criarSessao(mateus);
    expect(await validarSessao(cookie)).toEqual(mateus);
  });

  it("preserva nome com acento (payload passa por UTF-8, não Latin1)", async () => {
    const comAcento: Usuario = { email: "andre@indeba.com", nome: "André Núñez", papel: "user" };
    const cookie = await criarSessao(comAcento);
    expect((await validarSessao(cookie))?.nome).toBe("André Núñez");
  });

  it("rejeita cookie vazio ou indefinido", async () => {
    expect(await validarSessao(undefined)).toBeNull();
    expect(await validarSessao("")).toBeNull();
  });

  it("rejeita cookie com payload corrompido/não-base64", async () => {
    expect(await validarSessao("!!!nao-e-base64!!!.deadbeef")).toBeNull();
  });

  it("rejeita payload de um usuário com a assinatura de outro (HMAC cobre o payload inteiro)", async () => {
    const cookieMateus = await criarSessao(mateus);
    const cookieAdmin = await criarSessao(admin);
    const payloadMateus = cookieMateus.slice(0, cookieMateus.lastIndexOf("."));
    const sigAdmin = cookieAdmin.slice(cookieAdmin.lastIndexOf(".") + 1);
    expect(await validarSessao(`${payloadMateus}.${sigAdmin}`)).toBeNull();
  });

  it("rejeita sessão expirada (cookie não é replayável pra sempre)", async () => {
    const t0 = 1_000_000_000_000;
    const cookie = await criarSessao(mateus, t0);
    expect((await validarSessao(cookie, t0 + 1000))?.email).toBe(mateus.email); // recém-criada: válida
    expect(await validarSessao(cookie, t0 + 8 * 60 * 60 * 1000 + 1)).toBeNull(); // 8h+1ms: expirada
  });
});
