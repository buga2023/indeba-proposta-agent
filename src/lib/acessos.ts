import { prisma } from "@/lib/db";
import { nomesDeAutores } from "@/lib/autores";

/**
 * Registro de acessos — o pedido do Mateus no áudio de 10/09/2026: "por uma questão de
 * proteção de dados… é bom ter você fazendo as manutenções acessando por um login, a gente
 * ter o registro de toda vez que você fizer essas manutenções de acesso… eu não sei se você
 * consegue gerar lá na plataforma para mim, como administrador, ver os últimos acessos".
 *
 * A trilha é gravada no LOGIN (é ali que se sabe quem é, com senha conferida) e nunca no
 * middleware: sessão é assinada e vale 8h sem tocar o banco, então logar cada requisição
 * daria uma linha por clique e uma consulta a mais em toda navegação — muito ruído e
 * nenhuma informação nova.
 *
 * Gravar NÃO pode derrubar o login. Se o banco engasgar na inserção da trilha, quem estava
 * entrando entra do mesmo jeito: perder uma linha de auditoria é ruim, trancar a equipe
 * para fora do sistema é pior. Por isso `registrarAcesso` engole o próprio erro.
 */

export type ResultadoAcesso = "entrou" | "recusado";

export type RegistroAcesso = {
  id: string;
  email: string;
  /** Nome do cadastro; cai no e-mail quando a conta não existe (ou não existe mais). */
  nome: string | null;
  resultado: ResultadoAcesso;
  motivo: string | null;
  ip: string | null;
  agente: string | null;
  criadoEm: string;
};

// User-Agent inteiro é um parágrafo e não acrescenta nada à leitura do gestor — o que
// importa é distinguir celular de desktop. Trunca para caber na tela e no banco.
const MAX_AGENTE = 180;

/** IP de origem atrás do proxy da Vercel. `x-forwarded-for` é uma lista; o cliente é o 1º. */
export function ipDoRequest(req: { headers: { get(n: string): string | null } }): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim() || null;
  return req.headers.get("x-real-ip");
}

export async function registrarAcesso(
  req: { headers: { get(n: string): string | null } },
  email: string,
  resultado: ResultadoAcesso,
  motivo?: string,
): Promise<void> {
  try {
    await prisma.acessoLog.create({
      data: {
        email: email.trim().toLowerCase().slice(0, 200),
        resultado,
        motivo: motivo ?? null,
        ip: ipDoRequest(req),
        agente: req.headers.get("user-agent")?.slice(0, MAX_AGENTE) ?? null,
      },
    });
  } catch {
    // Trilha é registro, não portão: falha aqui não impede ninguém de entrar.
  }
}

/**
 * Últimos acessos, do mais recente para o mais antigo. Só o gestor lê — quem chama é
 * /api/acessos, que confere o papel no banco antes.
 *
 * O teto de 200 é deliberado: a tela é "os últimos acessos", não um relatório paginado. Se
 * um dia precisar de período e exportação, é aqui e na rota que muda.
 */
export async function listarAcessos(limite = 200): Promise<RegistroAcesso[]> {
  const rows = await prisma.acessoLog.findMany({
    orderBy: { criadoEm: "desc" },
    take: Math.min(Math.max(limite, 1), 200),
  });
  // UMA consulta ao cadastro para a lista inteira (mesma regra de lib/autores.ts): a tela
  // mostra o NOME de quem entrou, não o e-mail cru.
  const nomes = await nomesDeAutores(rows.map((r) => r.email));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    nome: nomes.get(r.email) ?? null,
    resultado: r.resultado === "recusado" ? "recusado" : "entrou",
    motivo: r.motivo,
    ip: r.ip,
    agente: r.agente,
    criadoEm: r.criadoEm.toISOString(),
  }));
}
