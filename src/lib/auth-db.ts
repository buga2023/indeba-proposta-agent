// Autenticação — lado banco (Node.js only, NUNCA importar do middleware/Edge). Cadastro
// próprio: o colaborador entra com nome/e-mail/senha (model Usuario, Prisma). O papel
// (admin/user) é decidido aqui, na criação da conta, por ADMIN_EMAILS (env).
import { prisma } from "@/lib/db";
import { gerarCredencial, validarHash, type Papel, type Usuario } from "@/lib/auth";

export class EmailEmUsoError extends Error {
  constructor() {
    super("Este e-mail já tem uma conta.");
  }
}

function papelPara(email: string): Papel {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase()) ? "admin" : "user";
}

export async function criarUsuario(nome: string, email: string, senha: string): Promise<Usuario> {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) throw new EmailEmUsoError();

  const credencial = await gerarCredencial(senha);
  const papel = papelPara(email);
  await prisma.usuario.create({ data: { nome, email, credencial, papel } });
  return { email, nome, papel };
}

export async function validarCredenciais(email: string, senha: string): Promise<Usuario | null> {
  const u = await prisma.usuario.findUnique({ where: { email } });
  if (!u) return null;
  if (!(await validarHash(senha, u.credencial))) return null;
  return { email: u.email, nome: u.nome, papel: u.papel as Papel };
}
