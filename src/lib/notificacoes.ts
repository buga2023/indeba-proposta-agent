import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import type { SessaoUsuario } from "@/lib/auth";

/**
 * Aviso ao gestor de que entrou solicitação comercial nova (áudio do Mateus, 31/08/2026:
 * "acusar um ícone de notificação ou e-mail automático… para todos os ADMs, de novas
 * solicitações. Quando o cara registrar lá uma informação, talvez um íconezinho de
 * notificação apareça para mim, isso é importante").
 *
 * São dois canais com confiabilidades diferentes, de propósito:
 *
 * - O CONTADOR (o íconezinho) é derivado — nunca uma tabela de notificações a manter em
 *   dia. "Novas" = solicitações vivas criadas depois do último carimbo de visto DAQUELE
 *   admin e lançadas por OUTRA pessoa. Não há estado a corromper: se o carimbo sumir, o
 *   pior que acontece é a lista inteira contar como nova.
 * - O E-MAIL é best-effort. Depende de SMTP_* (as mesmas credenciais da cobrança) e
 *   NUNCA pode derrubar o registro: o vendedor lançou a solicitação, e ela está salva —
 *   falhar o POST porque o SMTP caiu perderia o dado pelo aviso.
 *
 * O carimbo de visto mora em Config (chave→valor), um por admin, para não pedir migração
 * de schema por um contador.
 */

const chaveVisto = (email: string) => `solicitacoesVistasEm:${email}`;

async function vistasEm(email: string): Promise<Date | null> {
  const c = await prisma.config.findUnique({ where: { chave: chaveVisto(email) } });
  const t = c ? Date.parse(c.valor) : NaN;
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Quantas solicitações o gestor ainda não viu. Zero para quem não é admin. */
export async function contarNovasSolicitacoes(usuario: SessaoUsuario): Promise<number> {
  if (usuario.papel !== "admin") return 0;
  try {
    const desde = await vistasEm(usuario.email);
    return await prisma.solicitacaoComercial.count({
      where: {
        excluidoEm: null,
        // O que ele mesmo lançou não é novidade para ele.
        autor: { not: usuario.email },
        ...(desde ? { criadoEm: { gt: desde } } : {}),
      },
    });
  } catch {
    // Banco indisponível: a tela fica sem o selo, não quebra.
    return 0;
  }
}

/** Abriu a aba de solicitações → zera o selo daquele admin. */
export async function marcarSolicitacoesVistas(usuario: SessaoUsuario): Promise<void> {
  if (usuario.papel !== "admin") return;
  const valor = new Date().toISOString();
  await prisma.config.upsert({
    where: { chave: chaveVisto(usuario.email) },
    update: { valor },
    create: { chave: chaveVisto(usuario.email), valor },
  });
}

async function emailsDosAdmins(exceto: string): Promise<string[]> {
  // "para todos os ADMs" — quem tem papel admin no cadastro, mais os de ADMIN_EMAILS que
  // ainda não criaram conta. Sem quem acabou de lançar: ele não precisa se avisar.
  const doBanco = await prisma.usuario.findMany({ where: { papel: "admin" }, select: { email: true } });
  const doEnv = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const todos = new Set([...doBanco.map((u) => u.email.toLowerCase()), ...doEnv]);
  todos.delete(exceto.toLowerCase());
  return [...todos];
}

/**
 * E-mail automático aos admins. Best-effort por contrato: engole qualquer falha (SMTP
 * ausente, credencial errada, caixa recusando) porque o registro do vendedor já está
 * salvo e não pode ser perdido por causa do aviso. O selo do ícone segue funcionando
 * sozinho quando o SMTP não está configurado.
 */
export async function avisarAdminsDeSolicitacao(dados: {
  autor: string;
  autorNome?: string | null;
  tipo: string;
  cliente: string;
  observacao?: string | null;
}): Promise<void> {
  try {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return; // sem SMTP o aviso é só o ícone

    const destinatarios = await emailsDosAdmins(dados.autor);
    if (destinatarios.length === 0) return;

    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL direto; 587 = STARTTLS
      auth: { user, pass },
    });
    const quem = dados.autorNome?.trim() || dados.autor;
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? user,
      to: destinatarios.join(", "),
      subject: `Indeba — nova solicitação comercial (${dados.cliente})`,
      text: [
        `${quem} registrou uma nova solicitação comercial.`,
        ``,
        `Cliente: ${dados.cliente}`,
        `Tipo: ${dados.tipo}`,
        ...(dados.observacao?.trim() ? [`Observação: ${dados.observacao.trim()}`] : []),
        ``,
        `Abra Ferramentas Comerciais → Solicitações para atender.`,
      ].join("\n"),
    });
  } catch {
    // Silêncio proposital: ver o comentário do cabeçalho.
  }
}
