// Rate limit por IP via Upstash Redis. Liga só se as envs estiverem presentes
// (em local, sem Upstash, fica DESLIGADO). Janela generosa: permite 10-20
// prompts seguidos, mas barra abuso/DoS no endpoint público da Vercel.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  limiter =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(30, "60 s"),
          prefix: "agente-proposta",
          analytics: false,
        })
      : null;
  return limiter;
}

export async function rateLimitOk(ip: string): Promise<boolean> {
  const l = getLimiter();
  if (!l) return true; // sem Upstash configurado → não limita (local)
  const { success } = await l.limit(ip);
  return success;
}
