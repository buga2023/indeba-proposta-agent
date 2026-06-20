// Log append-only de propostas geradas (constituição §1.8 / OWASP A09).
// Registra cliente, itens, preços aplicados, autor e timestamp — imutável por uso
// (só anexa, nunca reescreve). Persistência por ambiente:
//   - Upstash Redis (Vercel): RPUSH numa lista — durável.
//   - Local: arquivo JSONL (append) em PDF_OUT_DIR.
import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { Redis } from "@upstash/redis";
import type { PropostaScope } from "./contracts";

const REDIS_KEY = "agente-proposta:log:propostas";

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export type EventoProposta = {
  ts: string;
  usuario: string;
  evento: "pdf";
  propostaId: string;
  cliente: string;
  tipo: string | null;
  itens: { codigo: string; nome: string; precos: string[] }[];
};

export function eventoDe(scope: PropostaScope, usuario: string): EventoProposta {
  return {
    ts: new Date().toISOString(),
    usuario,
    evento: "pdf",
    propostaId: scope.id,
    cliente: scope.cliente.razaoSocial,
    tipo: (scope as { tipo?: string }).tipo ?? null,
    itens: scope.itens.map((i) => ({
      codigo: i.codigo,
      nome: i.nome,
      precos: i.embalagens.map((e) => e.preco), // preço aplicado, do catálogo
    })),
  };
}

export function arquivoLog(): string {
  return join(process.env.PDF_OUT_DIR ?? "generated", "propostas.jsonl");
}

export async function registrarProposta(evento: EventoProposta): Promise<void> {
  const linha = JSON.stringify(evento);
  const r = getRedis();
  if (r) {
    await r.rpush(REDIS_KEY, linha); // append-only, persistente (Vercel)
    return;
  }
  const arquivo = arquivoLog();
  mkdirSync(dirname(arquivo), { recursive: true });
  appendFileSync(arquivo, linha + "\n", "utf-8"); // append-only (local)
}
