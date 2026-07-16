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

export type Colaborador = { nome: string; email: string; papel: Papel; telefone: string | null };

// ── Perfil (nome/telefone) — o próprio colaborador edita o seu; o gestor edita o de
// qualquer um (ver /api/perfil e /api/colaboradores). Nunca mexe em e-mail/senha/papel.
export async function buscarColaborador(email: string): Promise<Colaborador | null> {
  const u = await prisma.usuario.findUnique({ where: { email } });
  if (!u) return null;
  return { nome: u.nome, email: u.email, papel: u.papel as Papel, telefone: u.telefone };
}

export async function listarColaboradores(): Promise<Colaborador[]> {
  const us = await prisma.usuario.findMany({ orderBy: { nome: "asc" } });
  return us.map((u) => ({ nome: u.nome, email: u.email, papel: u.papel as Papel, telefone: u.telefone }));
}

export async function atualizarColaborador(email: string, dados: { nome?: string; telefone?: string | null }): Promise<Colaborador> {
  const u = await prisma.usuario.update({ where: { email }, data: dados });
  return { nome: u.nome, email: u.email, papel: u.papel as Papel, telefone: u.telefone };
}
