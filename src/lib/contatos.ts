import { prisma } from "@/lib/db";

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

// ── Disparo da cobrança para o webhook do n8n ─────────────────────────
export async function dispararCobranca(inadimplentes: unknown[], totalDevido: string): Promise<{ enviados: number }> {
  const url = process.env.N8N_COBRANCA_WEBHOOK;
  if (!url) throw new Error("Webhook de cobrança não configurado (N8N_COBRANCA_WEBHOOK).");
  const gestorEmail = await getGestorEmail();
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gestorEmail, totalDevido, inadimplentes }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`n8n respondeu ${r.status}`);
  const comEmail = (inadimplentes as { email?: string | null }[]).filter((i) => i.email).length;
  return { enviados: comEmail };
}
