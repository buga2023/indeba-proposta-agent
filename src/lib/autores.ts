import { prisma } from "@/lib/db";

/**
 * Nome de quem lançou o registro (áudio do Mateus, 31/08/2026: "o nome do pessoal que
 * lançou, não o e-mail, porque o registro está aparecendo aí no e-mail de quem lançou e
 * não o nome do usuário").
 *
 * O `autor` gravado na linha continua sendo o E-MAIL — é a chave estável da sessão, e
 * trocá-lo por nome quebraria o recorte por autor de toda ferramenta. O nome é resolvido
 * na LEITURA, contra o model Usuario, e viaja como `autorNome` ao lado do `autor`. Quem
 * não existe mais no cadastro (conta removida) cai no próprio e-mail na tela.
 */

// Uma consulta para a listagem inteira — nunca uma por linha.
export async function nomesDeAutores(emails: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(emails.filter(Boolean))];
  if (unicos.length === 0) return mapa;
  try {
    const rows = await prisma.usuario.findMany({ where: { email: { in: unicos } }, select: { email: true, nome: true } });
    for (const r of rows) if (r.nome?.trim()) mapa.set(r.email, r.nome.trim());
  } catch {
    // Banco de usuários indisponível: a tela cai no e-mail, a listagem não quebra.
  }
  return mapa;
}

export async function nomeDeAutor(email: string): Promise<string | null> {
  return (await nomesDeAutores([email])).get(email) ?? null;
}
