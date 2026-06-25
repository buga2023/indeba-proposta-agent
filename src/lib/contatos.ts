import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import type { Inadimplente } from "@/lib/contracts";

// "Sistema que aprende": cada planilha que traz o e-mail de um cliente grava no cadastro;
// clientes sem e-mail na planilha são preenchidos pelo que já foi aprendido antes.
const GESTOR_EMAIL_PADRAO = process.env.GESTOR_EMAIL ?? "gustavossantos2905@gmail.com";

export async function aprenderEPreencherEmails<T extends { cliente: string; email: string | null }>(
  itens: T[],
): Promise<T[]> {
  // 1) Aprende: grava os e-mails que vieram na planilha.
  for (const i of itens) {
    if (i.email) {
      await prisma.contatoCliente.upsert({
        where: { cliente: i.cliente },
        update: { email: i.email },
        create: { cliente: i.cliente, email: i.email },
      });
    }
  }
  // 2) Preenche os que ficaram sem e-mail, pelo cadastro aprendido.
  const semEmail = itens.filter((i) => !i.email).map((i) => i.cliente);
  if (semEmail.length) {
    const cadastro = await prisma.contatoCliente.findMany({ where: { cliente: { in: semEmail } } });
    const mapa = new Map(cadastro.map((c) => [c.cliente, c.email]));
    for (const i of itens) if (!i.email) i.email = mapa.get(i.cliente) ?? null;
  }
  return itens;
}

// ── Cadastro de e-mails (painel de admin) ─────────────────────────────
export function listarContatos() {
  return prisma.contatoCliente.findMany({ orderBy: { cliente: "asc" } });
}
export function salvarContato(cliente: string, email: string) {
  return prisma.contatoCliente.upsert({
    where: { cliente },
    update: { email },
    create: { cliente, email },
  });
}
export async function removerContato(cliente: string) {
  await prisma.contatoCliente.delete({ where: { cliente } }).catch(() => {});
}

// ── E-mail do gestor (Config, editável no painel) ─────────────────────
export async function getGestorEmail(): Promise<string> {
  const c = await prisma.config.findUnique({ where: { chave: "gestorEmail" } });
  return c?.valor ?? GESTOR_EMAIL_PADRAO;
}
export async function setGestorEmail(email: string): Promise<void> {
  await prisma.config.upsert({
    where: { chave: "gestorEmail" },
    update: { valor: email },
    create: { chave: "gestorEmail", valor: email },
  });
}

// ── Disparo da cobrança: envia e-mail direto via SMTP (sem n8n) ───────────────
// Serverless-native (roda no runtime Node da rota, não depende de PC/n8n ligado).
// Um e-mail por inadimplente COM e-mail (corpo = a régua já pronta do motor §2) +
// um resumo ao gestor. Mesmo assunto/corpo do fluxo n8n antigo (docs/n8n/cobranca-email.json).
// Credencial via SMTP_* — sem domínio, use Gmail (smtp.gmail.com + app password).
export async function dispararCobranca(
  inadimplentes: Inadimplente[],
  totalDevido: string,
): Promise<{ enviados: number; falhas: number }> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("Envio de e-mail não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  const from = process.env.SMTP_FROM ?? user;
  const gestorEmail = await getGestorEmail();
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL direto; 587 = STARTTLS
    auth: { user, pass },
  });

  // 1) Um e-mail por cliente que tem e-mail.
  const comEmail = inadimplentes.filter((i) => i.email);
  const semEmail = inadimplentes.filter((i) => !i.email);
  const resultados = await Promise.allSettled(
    comEmail.map((i) =>
      transport.sendMail({
        from,
        to: i.email!,
        subject: `Indeba — aviso de pagamento em aberto (${i.cliente})`,
        text: i.mensagem,
      }),
    ),
  );
  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  const falhas = resultados.length - enviados;

  // 2) Resumo ao gestor (mesma formatação do nó "resumo gestor" do n8n).
  const linha = (i: Inadimplente) => `• ${i.cliente} — R$ ${i.valorDevido} (${i.diasAtraso} dias, ${i.severidade})`;
  const corpo = [
    `Disparo de cobrança concluído.`,
    ``,
    `Clientes cobrados por e-mail: ${enviados} de ${inadimplentes.length}`,
    `Total em aberto: R$ ${totalDevido}`,
    ``,
    `— Enviados —`,
    ...comEmail.map(linha),
    ...(semEmail.length ? [``, `— SEM E-MAIL (não enviados, cadastre o e-mail) —`, ...semEmail.map(linha)] : []),
    ...(falhas ? [``, `⚠ ${falhas} e-mail(s) ao cliente falharam no envio.`] : []),
  ].join("\n");
  await transport.sendMail({
    from,
    to: gestorEmail,
    subject: `Resumo de cobrança Indeba — ${enviados}/${inadimplentes.length} enviados`,
    text: corpo,
  });

  return { enviados, falhas };
}
