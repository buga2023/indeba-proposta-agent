// Autenticação — lado banco (Node.js only, NUNCA importar do middleware/Edge). Cadastro
// próprio: o colaborador entra com nome/e-mail/senha (model Usuario, Prisma). O papel
// (admin/user) é decidido aqui, na criação da conta, por ADMIN_EMAILS (env).
import { prisma } from "@/lib/db";
import { gerarCredencial, validarHash, type Acesso, type Papel, type Usuario } from "@/lib/auth";

export class EmailEmUsoError extends Error {
  constructor() {
    super("Este e-mail já tem uma conta.");
  }
}

// Recusa de acesso é diferente de senha errada: a credencial CONFERE, o que falta é a
// liberação do gestor. Quem tenta entrar precisa saber que a conta existe e está na fila —
// senão fica tentando redefinir uma senha que está certa.
export class AcessoPendenteError extends Error {
  constructor(readonly acesso: Acesso) {
    super(
      acesso === "pendente"
        ? "Sua conta está aguardando liberação do gestor."
        : "Seu acesso foi encerrado. Fale com o gestor.",
    );
  }
}

function papelPara(email: string): Papel {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase()) ? "admin" : "user";
}

// Cadastro é aberto, entrada não é: a conta nasce PENDENTE e o gestor libera no painel.
// Exceção para quem está em ADMIN_EMAILS — é o gestor criando a própria conta, e ninguém
// pode aprová-lo (seria um sistema sem quem aprove o primeiro).
export async function criarUsuario(nome: string, email: string, senha: string): Promise<Usuario & { acesso: Acesso }> {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) throw new EmailEmUsoError();

  const credencial = await gerarCredencial(senha);
  const papel = papelPara(email);
  const acesso: Acesso = papel === "admin" ? "aprovado" : "pendente";
  await prisma.usuario.create({ data: { nome, email, credencial, papel, acesso } });
  return { email, nome, papel, acesso };
}

// Senha errada → null (401 genérico). Senha CERTA mas sem liberação → AcessoPendenteError,
// para a tela de login dizer o que está faltando em vez de acusar credencial inválida.
export async function validarCredenciais(email: string, senha: string): Promise<Usuario | null> {
  const u = await prisma.usuario.findUnique({ where: { email } });
  if (!u) return null;
  if (!(await validarHash(senha, u.credencial))) return null;
  if (u.acesso !== "aprovado") throw new AcessoPendenteError(u.acesso as Acesso);
  return { email: u.email, nome: u.nome, papel: u.papel as Papel };
}

// O cookie de sessão é autocontido e vale 8h sem tocar o banco — então revogar alguém não
// derruba na hora quem já está logado. Esta consulta é o que fecha essa janela: /api/me a
// chama a cada carregamento do app, e quem perdeu o acesso volta para o login na próxima
// navegação em vez de ficar até a sessão expirar.
export async function acessoDe(email: string): Promise<Acesso | null> {
  const u = await prisma.usuario.findUnique({ where: { email }, select: { acesso: true } });
  return (u?.acesso as Acesso) ?? null;
}

export type Colaborador = { nome: string; email: string; papel: Papel; acesso: Acesso; telefone: string | null; criadoEm: string };

// ── Perfil (nome/telefone) — o próprio colaborador edita o seu; o gestor edita o de
// qualquer um (ver /api/perfil e /api/colaboradores). Nunca mexe em e-mail/senha/papel.
type LinhaUsuario = { nome: string; email: string; papel: string; acesso: string; telefone: string | null; criadoEm: Date };

const mapear = (u: LinhaUsuario): Colaborador => ({
  nome: u.nome,
  email: u.email,
  papel: u.papel as Papel,
  acesso: u.acesso as Acesso,
  telefone: u.telefone,
  criadoEm: u.criadoEm.toISOString(),
});

export async function buscarColaborador(email: string): Promise<Colaborador | null> {
  const u = await prisma.usuario.findUnique({ where: { email } });
  return u ? mapear(u) : null;
}

// Pendente primeiro: a fila de aprovação é o que o gestor abre o painel para resolver, e
// ordenar só por nome esconderia um cadastro novo no meio da lista do time inteiro.
export async function listarColaboradores(): Promise<Colaborador[]> {
  const us = await prisma.usuario.findMany({ orderBy: [{ criadoEm: "desc" }] });
  const ordem: Record<string, number> = { pendente: 0, aprovado: 1, bloqueado: 2 };
  return us
    .map(mapear)
    .sort((a, b) => (ordem[a.acesso] - ordem[b.acesso]) || a.nome.localeCompare(b.nome));
}

export async function atualizarColaborador(
  email: string,
  dados: { nome?: string; telefone?: string | null; papel?: Papel; acesso?: Acesso },
): Promise<Colaborador> {
  return mapear(await prisma.usuario.update({ where: { email }, data: dados }));
}
