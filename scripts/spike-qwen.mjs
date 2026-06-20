// Spike de de-risco — prova que o Qwen 7B segura saída estruturada (JSON Schema)
// para briefing -> PedidoScope.facetas_detectadas (spec §3 / §4.2).
// Roda com: node scripts/spike-qwen.mjs   (Ollama no host, modelo já puxado)
// NÃO é código de produção — o pipeline formal (Zod + retry) entra no Marco 2.

const OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

// Vocabulário fechado de facetas (spec §3) — enums viram o contrato do schema.
const F1_LINHA = ["lavanderia", "alimentos_bebidas", "limpeza_conservacao",
  "higiene_clinica", "higiene_pessoal", "tratamento_pisos", "automotiva"];
const F2_SEGMENTO = ["laticinio", "cozinha_industrial", "hortifruti",
  "industria_bebidas", "administrativo"];
const F3_FUNCAO = ["desengordurante", "desinfetante", "desincrustante",
  "sabonete", "antisseptico", "multiuso", "cip"];
const F4_METODO = ["diluidor_automatico", "pulverizacao", "imersao",
  "circulacao_cip", "manual"];

// JSON Schema enviado no campo `format` do Ollama (structured output real).
const schema = {
  type: "object",
  properties: {
    facetas_detectadas: {
      type: "object",
      properties: {
        linha: { type: "array", items: { type: "string", enum: F1_LINHA } },
        segmento: { type: "array", items: { type: "string", enum: F2_SEGMENTO } },
        funcao: { type: "array", items: { type: "string", enum: F3_FUNCAO } },
        metodo: { type: "array", items: { type: "string", enum: F4_METODO } },
      },
      required: ["linha", "segmento", "funcao", "metodo"],
      additionalProperties: false,
    },
  },
  required: ["facetas_detectadas"],
  additionalProperties: false,
};

const SYSTEM = `Você é um extrator de facetas para um catálogo de produtos de limpeza industrial da Indeba.
Leia o briefing do vendedor e extraia APENAS as facetas que o texto sustenta.
Use somente os valores permitidos pelo schema. Se uma faceta não aparecer no texto, retorne lista vazia.
Não invente. Responda só com o JSON no formato pedido.`;

// Briefings de teste (português real, com gírias e implícitos do domínio).
const BRIEFINGS = [
  {
    texto: "Laticínio Taquipe, limpeza CIP das linhas de produção, desinfecção e sabonete para os colaboradores.",
    espera: { linha: "alimentos_bebidas", segmento: "laticinio", funcao: ["cip", "desinfetante", "sabonete"] },
  },
  {
    texto: "Cozinha industrial de um restaurante grande: precisa de desengordurante pra coifa e piso, e antisséptico pras mãos da equipe.",
    espera: { linha: "limpeza_conservacao", segmento: "cozinha_industrial", funcao: ["desengordurante", "antisseptico"] },
  },
  {
    texto: "Distribuidora de hortifruti, querem um multiuso pra limpeza geral e desinfetante pras câmaras frias, aplicado por diluidor automático.",
    espera: { segmento: "hortifruti", funcao: ["multiuso", "desinfetante"], metodo: "diluidor_automatico" },
  },
  {
    texto: "Indústria de bebidas, remoção de incrustação nos tanques por circulação CIP.",
    espera: { linha: "alimentos_bebidas", segmento: "industria_bebidas", funcao: ["desincrustante", "cip"], metodo: "circulacao_cip" },
  },
];

async function extrair(texto) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: texto },
    ],
    format: schema,
    stream: false,
    options: { temperature: 0 },
  };
  const t0 = Date.now();
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { raw: data.message?.content ?? "", ms };
}

const ALLOWED = { linha: F1_LINHA, segmento: F2_SEGMENTO, funcao: F3_FUNCAO, metodo: F4_METODO };

// Validação leve (sem deps): parseia, confere as 4 chaves como arrays e enum-membership.
function validar(raw) {
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { return { ok: false, erro: "JSON inválido: " + e.message }; }
  const f = obj.facetas_detectadas;
  if (!f || typeof f !== "object") return { ok: false, erro: "sem facetas_detectadas" };
  for (const k of ["linha", "segmento", "funcao", "metodo"]) {
    if (!Array.isArray(f[k])) return { ok: false, erro: `'${k}' não é array` };
    for (const v of f[k]) {
      if (!ALLOWED[k].includes(v)) return { ok: false, erro: `valor fora do enum em '${k}': ${v}` };
    }
  }
  return { ok: true, facetas: f };
}

async function main() {
  console.log(`Spike Qwen — modelo=${MODEL} @ ${OLLAMA}\n${"=".repeat(60)}`);
  let passes = 0;
  for (const [i, b] of BRIEFINGS.entries()) {
    process.stdout.write(`\n[${i + 1}/${BRIEFINGS.length}] "${b.texto.slice(0, 60)}..."\n`);
    try {
      const { raw, ms } = await extrair(b.texto);
      const v = validar(raw);
      if (v.ok) {
        passes++;
        console.log(`  ✓ JSON válido + enums ok (${ms} ms)`);
        console.log(`    -> ${JSON.stringify(v.facetas)}`);
        console.log(`    esperado (referência): ${JSON.stringify(b.espera)}`);
      } else {
        console.log(`  ✗ FALHOU validação: ${v.erro}`);
        console.log(`    raw: ${raw}`);
      }
    } catch (e) {
      console.log(`  ✗ ERRO de chamada: ${e.message}`);
    }
  }
  console.log(`\n${"=".repeat(60)}\nRESULTADO: ${passes}/${BRIEFINGS.length} briefings com JSON-schema válido.`);
  console.log(passes === BRIEFINGS.length
    ? "VEREDITO: 7B segura structured output — pode construir o Marco 2 em cima."
    : "VEREDITO: revisar (subir pra 14B, ajustar prompt, ou pré-passo determinístico).");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
