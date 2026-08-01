import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka só o acesso ao banco — o foco é a REGRA de papel/duplicidade, não o Prisma.
const findUnique = vi.fn();
const create = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { usuario: { findUnique: (a: unknown) => findUnique(a), create: (a: unknown) => create(a) } },
}));

import { criarUsuario, validarCredenciais, AcessoPendenteError, EmailEmUsoError } from "@/lib/auth-db";
import { gerarCredencial } from "@/lib/auth";

beforeEach(() => {
  findUnique.mockReset();
  create.mockReset();
  delete process.env.ADMIN_EMAILS;
});

describe("auth-db — cadastro próprio e login (banco)", () => {
  it("criarUsuario: e-mail em ADMIN_EMAILS nasce admin", async () => {
    process.env.ADMIN_EMAILS = "admin@indeba.example";
    findUnique.mockResolvedValue(null);
    const u = await criarUsuario("Admin Exemplo", "admin@indeba.example", "senha12345");
    expect(u.papel).toBe("admin");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "admin@indeba.example", papel: "admin" }) }),
    );
  });

  it("criarUsuario: e-mail fora de ADMIN_EMAILS nasce user (comparação sem diferenciar maiúsculas)", async () => {
    process.env.ADMIN_EMAILS = "Admin@Indeba.example";
    findUnique.mockResolvedValue(null);
    const admin = await criarUsuario("Admin Exemplo", "admin@indeba.example", "senha12345");
    expect(admin.papel).toBe("admin");

    findUnique.mockResolvedValue(null);
    const user = await criarUsuario("Mateus", "mateus@indeba.example", "senha12345");
    expect(user.papel).toBe("user");
  });

  it("criarUsuario: rejeita e-mail já cadastrado, sem tentar criar de novo", async () => {
    findUnique.mockResolvedValue({ id: "1", email: "x@x.com" });
    await expect(criarUsuario("X", "x@x.com", "senha12345")).rejects.toBeInstanceOf(EmailEmUsoError);
    expect(create).not.toHaveBeenCalled();
  });

  it("validarCredenciais: aceita senha certa, rejeita errada e e-mail inexistente", async () => {
    const credencial = await gerarCredencial("indeba@2026");
    findUnique.mockResolvedValue({ email: "mateus@indeba.com", nome: "Mateus", credencial, papel: "user", acesso: "aprovado" });
    expect((await validarCredenciais("mateus@indeba.com", "indeba@2026"))?.papel).toBe("user");
    expect(await validarCredenciais("mateus@indeba.com", "errada")).toBeNull();

    findUnique.mockResolvedValue(null);
    expect(await validarCredenciais("ninguem@x.com", "x")).toBeNull();
  });

  // Desde 01/08/2026 o cadastro é aberto mas a ENTRADA depende do gestor: a conta nasce
  // pendente e o login só passa depois da liberação. Senha certa + acesso faltando é um
  // caso distinto de senha errada, e por isso lança em vez de devolver null — a tela
  // precisa dizer "aguardando liberação", não "e-mail ou senha inválidos".
  it("validarCredenciais: senha certa mas conta PENDENTE não entra", async () => {
    const credencial = await gerarCredencial("senha12345");
    findUnique.mockResolvedValue({ email: "novo@indeba.com", nome: "Novo", credencial, papel: "user", acesso: "pendente" });
    await expect(validarCredenciais("novo@indeba.com", "senha12345")).rejects.toBeInstanceOf(AcessoPendenteError);
  });

  it("validarCredenciais: acesso revogado também não entra", async () => {
    const credencial = await gerarCredencial("senha12345");
    findUnique.mockResolvedValue({ email: "ex@indeba.com", nome: "Ex", credencial, papel: "user", acesso: "bloqueado" });
    await expect(validarCredenciais("ex@indeba.com", "senha12345")).rejects.toBeInstanceOf(AcessoPendenteError);
  });

  it("criarUsuario: colaborador nasce PENDENTE; o gestor de ADMIN_EMAILS já nasce aprovado", async () => {
    process.env.ADMIN_EMAILS = "gestor@indeba.example";

    findUnique.mockResolvedValue(null);
    const colaborador = await criarUsuario("Vendedor", "vendedor@indeba.example", "senha12345");
    expect(colaborador.acesso).toBe("pendente");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ acesso: "pendente" }) }));

    // O gestor não teria quem o aprovasse — seria um sistema trancado sem chave.
    findUnique.mockResolvedValue(null);
    const gestor = await criarUsuario("Gestor", "gestor@indeba.example", "senha12345");
    expect(gestor.acesso).toBe("aprovado");
  });
});
