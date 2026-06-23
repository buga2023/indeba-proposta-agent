// Seed de AMOSTRA real: garimpa CNPJs de páginas (Tavily), consulta o BrasilAPI
// (dado oficial da Receita) e popula EmpresaReceita. Mesmo mecanismo do loader.
// Uso: DATABASE_URL=... TAVILY_API_KEY=... node prisma/seed-amostra.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAVILY = process.env.TAVILY_API_KEY;

const RE_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;

function cnpjValido(c) {
  const n = c.replace(/\D/g, "");
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const calc = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = base.split("").reduce((a, d, i) => a + Number(d) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(n.slice(0, 12)) === Number(n[12]) && calc(n.slice(0, 13)) === Number(n[13]);
}

async function tavilyCnpjs(query) {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY, query, max_results: 8, include_raw_content: true }),
  });
  if (!r.ok) return [];
  const d = await r.json();
  const set = new Set();
  for (const res of d.results ?? []) {
    const txt = `${res.raw_content ?? ""} ${res.content ?? ""}`;
    for (const m of txt.match(RE_CNPJ) ?? []) {
      const n = m.replace(/\D/g, "");
      if (cnpjValido(n)) set.add(n);
    }
  }
  return [...set];
}

async function brasilApi(cnpj) {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { "User-Agent": "Mozilla/5.0 (indeba-prospeccao)" },
  });
  if (!r.ok) {
    console.log(`    BrasilAPI ${cnpj} -> HTTP ${r.status}`);
    return null;
  }
  return r.json();
}

const digits = (s) => (s ? String(s).replace(/\D/g, "") : null) || null;

async function main() {
  const queries = [
    "padaria Belo Horizonte CNPJ",
    "restaurante Belo Horizonte CNPJ rodapé",
    "supermercado Belo Horizonte CNPJ contato",
  ];
  const cnpjs = new Set();
  for (const q of queries) {
    try {
      for (const c of await tavilyCnpjs(q)) cnpjs.add(c);
    } catch (e) {
      console.log("tavily falhou:", q, e.message);
    }
  }
  console.log("CNPJs garimpados:", cnpjs.size);

  let ok = 0;
  // BrasilAPI tem rate limit baixo — limita a amostra e espaça as consultas.
  const alvo = [...cnpjs].slice(0, 15);
  for (const cnpj of alvo) {
    await new Promise((r) => setTimeout(r, 3000)); // ~20 req/min, dentro do limite
    let info;
    try {
      info = await brasilApi(cnpj);
    } catch (e) {
      console.log(`    ${cnpj} erro: ${e.message}`);
      continue;
    }
    if (!info || !info.razao_social) continue;
    await prisma.empresaReceita.upsert({
      where: { cnpj },
      create: mapear(cnpj, info),
      update: mapear(cnpj, info),
    });
    ok++;
    console.log(`  + ${cnpj} ${info.razao_social} (${info.municipio}/${info.uf}) CNAE ${info.cnae_fiscal} ${info.descricao_situacao_cadastral}`);
  }
  console.log(`gravados: ${ok}`);
  await prisma.$disconnect();
}

function mapear(cnpj, info) {
  return {
    cnpj,
    razaoSocial: info.razao_social,
    nomeFantasia: info.nome_fantasia || null,
    cnaePrincipal: String(info.cnae_fiscal ?? "").padStart(7, "0"),
    situacao: (info.descricao_situacao_cadastral || "").toUpperCase(),
    uf: info.uf || "",
    municipioNome: info.municipio || null,
    municipioCod: null,
    bairro: info.bairro || null,
    logradouro: [info.descricao_tipo_de_logradouro, info.logradouro].filter(Boolean).join(" ") || null,
    numero: info.numero || null,
    cep: digits(info.cep),
    telefone1: digits(info.ddd_telefone_1),
    telefone2: digits(info.ddd_telefone_2),
    email: info.email || null,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
