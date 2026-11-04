// Corrige o ano dos registros digitados errado (áudio do Mateus, 03/11/2026: entrou
// "0026" em vez de 2026 e apareceu a pasta "0026" no calendário).
//
//   node --env-file=.env.local scripts/corrigir-ano-registros.mts               # só lista
//   node --env-file=.env.local scripts/corrigir-ano-registros.mts --confirmar   # grava
//
// Regra: data cujo ano tem menos de 1000 (ex.: "0026") vira o ano vigente com o mesmo
// mês e dia. Nada além disso é tocado — mês e dia são o que o vendedor anotou. A partir
// de agora o contrato (src/lib/contracts/data-registro.ts) não deixa entrar de novo, e o
// gestor consegue corrigir pela tela; este script existe para arrumar o que já estava lá.
//
// Imprime o host do banco antes de escrever, para não mexer no ambiente errado.
import { PrismaClient } from "@prisma/client";

const CONFIRMAR = process.argv.includes("--confirmar");
const url = (process.env.DATABASE_URL ?? "").replace(/^["']|["']$/g, "");
if (!url) {
  console.error("DATABASE_URL ausente — rode com: node --env-file=.env.local scripts/corrigir-ano-registros.mts");
  process.exit(1);
}
let host: string;
try {
  host = new URL(url).host;
} catch {
  console.error("DATABASE_URL não é uma URL válida. Confira o .env.local.");
  process.exit(1);
}
console.log(`Banco: ${host}${CONFIRMAR ? "  (vai GRAVAR)" : "  (só leitura — use --confirmar para gravar)"}`);

const ANO = String(new Date().getFullYear());
const prisma = new PrismaClient({ datasources: { db: { url } } });

function corrigida(data: string): string | null {
  const m = /^(\d{4})-(\d{2}-\d{2})$/.exec(data);
  if (!m || Number(m[1]) >= 1000) return null;
  return `${ANO}-${m[2]}`;
}

try {
  const visitas = await prisma.visitaCarteira.findMany({ select: { id: true, data: true, cliente: true, autor: true } });
  const prospeccoes = await prisma.relatorioProspeccao.findMany({ select: { id: true, data: true, empresa: true, autor: true } });
  const alvos = [
    ...visitas.map((v) => ({ tabela: "visita" as const, id: v.id, data: v.data, nome: v.cliente, autor: v.autor })),
    ...prospeccoes.map((p) => ({ tabela: "prospeccao" as const, id: p.id, data: p.data, nome: p.empresa, autor: p.autor })),
  ]
    .map((r) => ({ ...r, nova: corrigida(r.data) }))
    .filter((r): r is typeof r & { nova: string } => r.nova !== null);

  if (alvos.length === 0) {
    console.log("Nenhum registro com ano errado.");
  } else {
    for (const r of alvos) console.log(`${r.tabela.padEnd(10)} ${r.data} → ${r.nova}  ${r.nome} (${r.autor})`);
    console.log(`${alvos.length} registro(s).`);
    if (CONFIRMAR) {
      for (const r of alvos) {
        if (r.tabela === "visita") await prisma.visitaCarteira.update({ where: { id: r.id }, data: { data: r.nova } });
        else await prisma.relatorioProspeccao.update({ where: { id: r.id }, data: { data: r.nova } });
      }
      console.log("Corrigido.");
    }
  }
} finally {
  await prisma.$disconnect();
}
