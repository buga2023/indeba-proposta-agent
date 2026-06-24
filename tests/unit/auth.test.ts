import { describe, it, expect, beforeAll } from "vitest";
import { validarCredenciais, criarSessao, validarSessao, authAtiva, gerarCredencial } from "@/lib/auth";

beforeAll(async () => {
  // AUTH_USERS agora guarda hash (salt.hash), não a senha — gera com a mesma função do app.
  const mateus = await gerarCredencial("indeba@2026");
  const gustavo = await gerarCredencial("1234567@");
  process.env.AUTH_USERS = `mateus:${mateus}:user,gustavo:${gustavo}:admin`;
  process.env.AUTH_SESSION_SECRET = "segredo-de-teste";
});

describe("auth — sessão assinada", () => {
  it("auth fica ativa quando há usuários", () => {
    expect(authAtiva()).toBe(true);
  });

  it("aceita credenciais corretas e rejeita erradas (senha via hash)", async () => {
    expect((await validarCredenciais("mateus", "indeba@2026"))?.papel).toBe("user");
    expect((await validarCredenciais("gustavo", "1234567@"))?.papel).toBe("admin");
    expect(await validarCredenciais("mateus", "errada")).toBeNull();
    expect(await validarCredenciais("ninguem", "x")).toBeNull();
  });

  it("AUTH_USERS em texto puro (formato antigo) é rejeitado — força regenerar", async () => {
    const orig = process.env.AUTH_USERS;
    process.env.AUTH_USERS = "velho:senhaCrua:admin"; // sem salt.hash
    expect(await validarCredenciais("velho", "senhaCrua")).toBeNull();
    process.env.AUTH_USERS = orig;
  });

  it("roundtrip: criarSessao → validarSessao devolve o usuário", async () => {
    const cookie = await criarSessao("mateus");
    const u = await validarSessao(cookie);
    expect(u?.login).toBe("mateus");
  });

  it("rejeita cookie adulterado ou vazio", async () => {
    const cookie = await criarSessao("mateus");
    expect(await validarSessao(cookie.replace("mateus", "gustavo"))).toBeNull(); // assinatura não bate
    expect(await validarSessao("mateus.deadbeef")).toBeNull();
    expect(await validarSessao(undefined)).toBeNull();
    expect(await validarSessao("")).toBeNull();
  });

  it("rejeita sessão expirada (cookie não é replayável pra sempre)", async () => {
    const t0 = 1_000_000_000_000;
    const cookie = await criarSessao("mateus", t0);
    expect((await validarSessao(cookie, t0 + 1000))?.login).toBe("mateus"); // recém-criada: válida
    expect(await validarSessao(cookie, t0 + 8 * 60 * 60 * 1000 + 1)).toBeNull(); // 8h+1ms: expirada
  });

  it("rejeita cookie com exp adulterado (assinatura cobre o exp)", async () => {
    const t0 = 1_000_000_000_000;
    const cookie = await criarSessao("mateus", t0);
    const [login, , sig] = cookie.split(".");
    const forjado = `${login}.${t0 + 999 * 60 * 60 * 1000}.${sig}`; // tenta estender a validade
    expect(await validarSessao(forjado, t0 + 1000)).toBeNull();
  });
});
