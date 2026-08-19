// Rate limit por IP via Upstash Redis. Liga só se as envs estiverem presentes
// (em local, sem Upstash, fica DESLIGADO). Dois baldes independentes:
//  - "auth": login/cadastro — estrito, contra brute force. Estourar este NÃO
//    afeta o resto da API (e vice-versa: uso normal do app não trava o login).
//  - "api": demais rotas — folgado o bastante para rajadas legítimas do app
//    (excluir várias propostas, salvar itens em sequência), mas barra abuso.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type BaldeLimite = "auth" | "api";

const JANELAS: Record<BaldeLimite, { limite: number; janela: "60 s" }> = {
  auth: { limite: 10, janela: "60 s" },
  api: { limite: 120, janela: "60 s" },
};

let redis: Redis | null | undefined;
const limiters = new Map<BaldeLimite, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function getLimiter(balde: BaldeLimite): Ratelimit | null {
  const r = getRedis();
  if (!r) return null; // sem Upstash configurado → não limita (local)
  let l = limiters.get(balde);
  if (!l) {
    const { limite, janela } = JANELAS[balde];
    l = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limite, janela),
      prefix: `agente-proposta:${balde}`,
      analytics: false,
    });
    limiters.set(balde, l);
  }
  return l;
}

export async function rateLimitOk(ip: string, balde: BaldeLimite = "api"): Promise<boolean> {
  const l = getLimiter(balde);
  if (!l) return true;
  const { success } = await l.limit(ip);
  return success;
}
