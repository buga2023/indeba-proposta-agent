// Verificação end-to-end da faxina de fim de expediente contra um Postgres de verdade.
// Semeia propostas de datas diferentes, chama a rota do cron e confere o estado final.
// NÃO é para rodar em produção: ele cria e apaga as próprias linhas (prefixo FAXINA-TESTE-).
//
// Uso: CRON_SECRET=... BASE_URL=http://127.0.0.1:3188 node scripts/verificar-faxina.mjs

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3188";
const SEGREDO = process.env.CRON_SECRET ?? "segredo-de-teste-local";
const PREFIXO = "FAXINA-TESTE-";

let falhas = 0;
const check = (nome, ok, det = "") => {
  console.log(`${ok ? "  ok  " : " FALHA"} — ${nome}${det ? ` (${det})` : ""}`);
  if (!ok) falhas++;
};

const scope = (id) => ({
  id,
  tipo: "orcamento",
  cliente: { razaoSocial: "Cliente Faxina", cnpj: null, segmento: null, responsavel: null },
  itens: [],
});

async function semear(sufixo, criadoEm, status = "rascunho") {
  const id = PREFIXO + sufixo;
  await prisma.proposta.create({
    data: {
      id,
      status,
      autor: "verificacao@local",
      cliente: "Cliente Faxina",
      segmento: null,
      tipo: "orcamento",
      total: new Prisma.Decimal("100.00"),
      scope: scope(id),
      criadoEm,
    },
  });
  return id;
}

const statusDe = async (id) => (await prisma.proposta.findUnique({ where: { id } }))?.status;

async function limpar() {
  await prisma.proposta.deleteMany({ where: { id: { startsWith: PREFIXO } } });
}

try {
  await limpar();

  // Corte = meia-noite de Brasília de hoje. "Hoje cedo" fica depois do corte; o resto, antes.
  const agora = new Date();
  const hojeCedo = new Date(agora.getTime() - 60 * 60 * 1000); // 1h atrás — mesmo dia BRT
  const ontem = new Date(agora.getTime() - 30 * 60 * 60 * 1000); // 30h atrás
  const mesPassado = new Date(agora.getTime() - 40 * 24 * 60 * 60 * 1000);

  const idHoje = await semear("hoje", hojeCedo);
  const idOntem = await semear("ontem", ontem);
  const idAntigo = await semear("antigo", mesPassado);
  const idJaArquivado = await semear("ja-arquivado", mesPassado, "arquivada");
  const idAprovadaAntiga = await semear("aprovada-antiga", ontem, "aprovada");

  // ── Portões de autenticação ──
  const semAuth = await fetch(`${BASE}/api/manutencao/arquivar-antigas`);
  check("sem Authorization → 401", semAuth.status === 401, `status=${semAuth.status}`);

  const authErrada = await fetch(`${BASE}/api/manutencao/arquivar-antigas`, {
    headers: { authorization: "Bearer errado" },
  });
  check("bearer errado → 401", authErrada.status === 401, `status=${authErrada.status}`);

  // ── Execução ──
  const r = await fetch(`${BASE}/api/manutencao/arquivar-antigas`, {
    headers: { authorization: `Bearer ${SEGREDO}` },
  });
  const body = await r.json();
  check("bearer correto → 200", r.status === 200, `status=${r.status} body=${JSON.stringify(body)}`);
  check("resposta traz o corte calculado", typeof body.corte === "string", `corte=${body.corte}`);

  // ── Estado final ──
  check("proposta de HOJE continua rascunho", (await statusDe(idHoje)) === "rascunho");
  check("proposta de ONTEM foi arquivada", (await statusDe(idOntem)) === "arquivada");
  check("proposta do MÊS PASSADO foi arquivada", (await statusDe(idAntigo)) === "arquivada");
  check("já arquivada continua arquivada", (await statusDe(idJaArquivado)) === "arquivada");
  check("aprovada antiga também é arquivada (regra é só de data)", (await statusDe(idAprovadaAntiga)) === "arquivada");

  // ── Idempotência ──
  const r2 = await fetch(`${BASE}/api/manutencao/arquivar-antigas`, {
    headers: { authorization: `Bearer ${SEGREDO}` },
  });
  const body2 = await r2.json();
  check("rodar de novo no mesmo dia arquiva 0", body2.arquivadas === 0, `arquivadas=${body2.arquivadas}`);

  // ── Listagem ──
  const padrao = await (await fetch(`${BASE}/api/propostas`)).json();
  const ids = padrao.propostas.map((p) => p.id);
  check("listagem padrão esconde as arquivadas", !ids.includes(idOntem) && !ids.includes(idAntigo));
  check("listagem padrão mantém a de hoje", ids.includes(idHoje));

  const comArquivadas = await (await fetch(`${BASE}/api/propostas?arquivadas=1`)).json();
  const idsA = comArquivadas.propostas.map((p) => p.id);
  check("?arquivadas=1 traz as arquivadas de volta", idsA.includes(idOntem) && idsA.includes(idAntigo));
} catch (e) {
  falhas++;
  console.error("ERRO:", e.message);
} finally {
  await limpar();
  await prisma.$disconnect();
}

console.log(falhas === 0 ? "\nFAXINA VALIDADA" : `\n${falhas} CHECK(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);
