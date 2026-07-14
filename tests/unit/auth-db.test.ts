import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka só o acesso ao banco — o foco é a REGRA de papel/duplicidade, não o Prisma.
const findUnique = vi.fn();
const create = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { usuario: { findUnique: (a: unknown) => findUnique(a), create: (a: unknown) => create(a) } },
}));

import { criarUsuario, validarCredenciais, EmailEmUsoError } from "@/lib/auth-db";
import { gerarCredencial } from "@/lib/auth";

beforeEach(() => {
  findUnique.mockReset();
  create.mockReset();
  delete process.env.ADMIN_EMAILS;
});

describe("auth-db — cadastro próprio e login (banco)", () => {
  it("criarUsuario: e-mail em ADMIN_EMAILS nasce admin", async () => {
    process.env.ADMIN_EMAILS = "gustavossantos2905@gmail.com";
    findUnique.mockResolvedValue(null);
    const u = await criarUsuario("Gustavo Santos", "gustavossantos2905@gmail.com", "senha12345");
    expect(u.papel).toBe("admin");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "gustavossantos2905@gmail.com", papel: "admin" }) }),
    );
  });

  it("criarUsuario: e-mail fora de ADMIN_EMAILS nasce user (comparação sem diferenciar maiúsculas)", async () => {
    process.env.ADMIN_EMAILS = "Gustavo@Gmail.com";
    findUnique.mockResolvedValue(null);
    const admin = await criarUsuario("Gustavo", "gustavo@gmail.com", "senha12345");
    expect(admin.papel).toBe("admin");

    findUnique.mockResolvedValue(null);
    const user = await criarUsuario("Mateus", "mateus@indeba.com", "senha12345");
    expect(user.papel).toBe("user");
  });

  it("criarUsuario: rejeita e-mail já cadastrado, sem tentar criar de novo", async () => {
    findUnique.mockResolvedValue({ id: "1", email: "x@x.com" });
    await expect(criarUsuario("X", "x@x.com", "senha12345")).rejects.toBeInstanceOf(EmailEmUsoError);
    expect(create).not.toHaveBeenCalled();
  });

  it("validarCredenciais: aceita senha certa, rejeita errada e e-mail inexistente", async () => {
    const credencial = await gerarCredencial("indeba@2026");
    findUnique.mockResolvedValue({ email: "mateus@indeba.com", nome: "Mateus", credencial, papel: "user" });
    expect((await validarCredenciais("mateus@indeba.com", "indeba@2026"))?.papel).toBe("user");
    expect(await validarCredenciais("mateus@indeba.com", "errada")).toBeNull();

    findUnique.mockResolvedValue(null);
    expect(await validarCredenciais("ninguem@x.com", "x")).toBeNull();
  });
});
