// Log append-only de feedback (mesmo padrão do log de propostas, §1.8): Upstash Redis na
// Vercel, arquivo JSONL local. Imutável por uso — só anexa. É o dataset que, com o tempo,
// mostra onde cada agente erra e alimenta o aprendizado (correções → conhecimento).
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { Redis } from "@upstash/redis";
import type { FeedbackRequest } from "../contracts";

const REDIS_KEY = "agente-proposta:log:feedback";

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export type EventoFeedback = FeedbackRequest & { ts: string; usuario: string };

function arquivo(): string {
  return join(process.env.PDF_OUT_DIR ?? "generated", "feedback.jsonl");
}

export async function registrarFeedback(ev: EventoFeedback): Promise<void> {
  const linha = JSON.stringify(ev);
  const r = getRedis();
  if (r) {
    await r.rpush(REDIS_KEY, linha);
    return;
  }
  const f = arquivo();
  mkdirSync(dirname(f), { recursive: true });
  appendFileSync(f, linha + "\n", "utf-8");
}

export async function lerFeedback(limite = 500): Promise<EventoFeedback[]> {
  const r = getRedis();
  if (r) {
    const linhas = await r.lrange<string>(REDIS_KEY, -limite, -1);
    return parse(linhas).reverse();
  }
  try {
    const conteudo = readFileSync(arquivo(), "utf-8").trim();
    if (!conteudo) return [];
    return parse(conteudo.split("\n")).slice(-limite).reverse();
  } catch {
    return [];
  }
}

function parse(linhas: (string | EventoFeedback)[]): EventoFeedback[] {
  const out: EventoFeedback[] = [];
  for (const l of linhas) {
    try {
      out.push(typeof l === "string" ? (JSON.parse(l) as EventoFeedback) : l);
    } catch {
      // linha corrompida — ignora (auditoria best-effort)
    }
  }
  return out;
}
