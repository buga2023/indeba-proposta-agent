// Log append-only de propostas geradas (constituição §1.8 / OWASP A09).
// Registra cliente, itens, preços aplicados, autor e timestamp — imutável por uso
// (só anexa, nunca reescreve). Persistência por ambiente:
//   - Upstash Redis (Vercel): RPUSH numa lista — durável.
//   - Local: arquivo JSONL (append) em PDF_OUT_DIR.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
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
  segmento: string | null;
  tipo: string | null;
  total: string; // total aplicado = Σ (preço da 1ª embalagem × quantidade)
  itens: { codigo: string; nome: string; quantidade: number; precos: string[] }[];
};

export function eventoDe(scope: PropostaScope, usuario: string): EventoProposta {
  let total = 0;
  const itens = scope.itens.map((i) => {
    const qtd = i.quantidade ?? 1;
    total += (Number(i.embalagens[0]?.preco) || 0) * qtd;
    return {
      codigo: i.codigo,
      nome: i.nome,
      quantidade: qtd,
      precos: i.embalagens.map((e) => e.preco), // preço aplicado, do catálogo
    };
  });
  return {
    ts: new Date().toISOString(),
    usuario,
    evento: "pdf",
    propostaId: scope.id,
    cliente: scope.cliente.razaoSocial,
    segmento: scope.cliente.segmento ?? null,
    tipo: (scope as { tipo?: string }).tipo ?? null,
    total: total.toFixed(2),
    itens,
  };
}

export function arquivoLog(): string {
  return join(process.env.PDF_OUT_DIR ?? "generated", "propostas.jsonl");
}

// Lê o log append-only (Redis ou JSONL local) e devolve os eventos do mais
// recente para o mais antigo. Best-effort: se não houver log ainda, devolve [].
export async function lerPropostas(limite = 200): Promise<EventoProposta[]> {
  const r = getRedis();
  if (r) {
    const linhas = await r.lrange<string>(REDIS_KEY, -limite, -1);
    return parseLinhas(linhas).reverse();
  }
  try {
    const conteudo = readFileSync(arquivoLog(), "utf-8").trim();
    if (!conteudo) return [];
    return parseLinhas(conteudo.split("\n")).slice(-limite).reverse();
  } catch {
    return []; // arquivo ainda não existe
  }
}

function parseLinhas(linhas: (string | EventoProposta)[]): EventoProposta[] {
  const out: EventoProposta[] = [];
  for (const l of linhas) {
    try {
      out.push(typeof l === "string" ? (JSON.parse(l) as EventoProposta) : l);
    } catch {
      // linha corrompida — ignora, log é best-effort de auditoria
    }
  }
  return out;
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
