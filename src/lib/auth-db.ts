// Autenticação — lado banco (Node.js only, NUNCA importar do middleware/Edge). Cadastro
// próprio: o colaborador entra com nome/e-mail/senha (model Usuario, Prisma). O papel
// (admin/user) é decidido aqui, na criação da conta, por ADMIN_EMAILS (env).
import { prisma } from "@/lib/db";
import { gerarCredencial, sessaoDoRequest, validarHash, type Acesso, type Papel, type SessaoUsuario, type Usuario } from "@/lib/auth";

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

function ehAdminPorEnv(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

function papelPara(email: string): Papel {
  return ehAdminPorEnv(email) ? "admin" : "user";
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

  // ADMIN_EMAILS vale no LOGIN, não só na criação da conta. Sem isto o dono do sistema fica
  // trancado fora do próprio painel: quem aprova e promove é o gestor, o painel só abre para
  // gestor, e `papelPara()` só roda uma vez, no cadastro — então uma conta criada antes de a
  // variável existir (o caso da produção da Indeba, onde ADMIN_EMAILS nunca foi definida)
  // nasce `user` e não há por onde se promover pela interface.
  //
  // Só PROMOVE, nunca rebaixa — e a diferença aqui não é detalhe. Rebaixar quem saiu da lista
  // desfaria, no login seguinte, cada "Tornar gestor" que o painel concedeu: com a env
  // contendo só o dono, todo gestor que ele promovesse voltaria a vendedor sozinho. A env é
  // a chave-mestra que destranca o primeiro gestor; quem manda em papel depois é o painel.
  if (ehAdminPorEnv(u.email) && (u.papel !== "admin" || u.acesso !== "aprovado")) {
    await prisma.usuario.update({ where: { email: u.email }, data: { papel: "admin", acesso: "aprovado" } });
    return { email: u.email, nome: u.nome, papel: "admin" };
  }

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

// Estado ATUAL da conta, do banco — não o que o cookie carimbou na hora do login.
//
// O papel viaja assinado no cookie e vale 8h, e isso transformava toda mudança de poder em
// "saia e entre de novo": promovido pelo painel continuava vendo tela de vendedor, e quem
// entrou em ADMIN_EMAILS não virava gestor até relogar — com o agravante de que, sem ser
// gestor, a pessoa não vê o painel nem o botão de cadastrar produto, então o sintoma é
// "não funciona" sem pista nenhuma. Aqui o banco é a fonte da verdade, e /api/me devolve
// isso a cada carregamento: mudou o papel, a próxima navegação já reflete.
//
// O bootstrap de ADMIN_EMAILS também roda aqui, e não só no login, pela mesma razão.
// Quem está pedindo, AUTORITATIVO: identidade do cookie, papel do banco.
//
// É por aqui que toda rota que decide por papel deve entrar. O cookie é assinado e vale 8h,
// então o papel carimbado nele envelhece: promover alguém no painel não teria efeito até a
// pessoa sair e entrar de novo — e como sem ser gestor ela não vê o painel nem o botão de
// cadastrar produto, o sintoma seria "não funciona", sem pista do que fazer.
//
// Custa uma busca por índice único por request. Vale: o preço de errar aqui é uma tela que
// promete um poder que a API nega, ou o contrário.
export async function usuarioAtual(
  req: { cookies: { get(n: string): { value: string } | undefined } },
): Promise<SessaoUsuario | null> {
  const s = await sessaoDoRequest(req);
  if (!s) return null;
  const estado = await estadoDaConta(s.email).catch(() => null);
  // Banco fora do ar ou conta ainda não persistida (dev local): mantém o papel do cookie em
  // vez de derrubar o pedido — degradar para "menos poder" trancaria o gestor para fora.
  return estado ? { email: s.email, papel: estado.papel } : s;
}

export async function estadoDaConta(email: string): Promise<{ papel: Papel; acesso: Acesso } | null> {
  const u = await prisma.usuario.findUnique({ where: { email }, select: { papel: true, acesso: true } });
  if (!u) return null;
  if (ehAdminPorEnv(email) && (u.papel !== "admin" || u.acesso !== "aprovado")) {
    await prisma.usuario.update({ where: { email }, data: { papel: "admin", acesso: "aprovado" } });
    return { papel: "admin", acesso: "aprovado" };
  }
  return { papel: u.papel as Papel, acesso: u.acesso as Acesso };
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

// As colunas do Colaborador — e só elas. Sem `select`, o Prisma traz a linha inteira, o que
// inclui `credencial` (o PBKDF2 "salt.hash" de cada senha): no painel do gestor isso é o
// hash do time TODO saindo do Postgres e passando pela memória da função a cada abertura de
// tela, para o `mapear` logo abaixo descartar. Nada vazava — mas o dado mais sensível da
// tabela não tem por que sair do banco para ser jogado fora.
const campos = { nome: true, email: true, papel: true, acesso: true, telefone: true, criadoEm: true } as const;

export async function buscarColaborador(email: string): Promise<Colaborador | null> {
  const u = await prisma.usuario.findUnique({ where: { email }, select: campos });
  return u ? mapear(u) : null;
}

// Pendente primeiro: a fila de aprovação é o que o gestor abre o painel para resolver, e
// ordenar só por nome esconderia um cadastro novo no meio da lista do time inteiro. A ordem
// final sai do comparador abaixo (acesso, depois nome), então o `orderBy` do banco é o nome
// — pedir `criadoEm` ali era ordenar por um critério que o `sort` seguinte descartava.
export async function listarColaboradores(): Promise<Colaborador[]> {
  const us = await prisma.usuario.findMany({ select: campos, orderBy: { nome: "asc" } });
  const ordem: Record<string, number> = { pendente: 0, aprovado: 1, bloqueado: 2 };
  return us
    .map(mapear)
    .sort((a, b) => (ordem[a.acesso] - ordem[b.acesso]) || a.nome.localeCompare(b.nome));
}

export async function atualizarColaborador(
  email: string,
  dados: { nome?: string; telefone?: string | null; papel?: Papel; acesso?: Acesso },
): Promise<Colaborador> {
  return mapear(await prisma.usuario.update({ where: { email }, data: dados, select: campos }));
}
