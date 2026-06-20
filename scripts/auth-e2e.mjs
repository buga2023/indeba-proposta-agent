// Prova do gate de auth no servidor de produção (proxy + login).
//   node scripts/auth-e2e.mjs   (BASE=http://localhost:3100, AUTH_USERS ativo)
const BASE = process.env.BASE ?? "http://localhost:3100";
const json = { "Content-Type": "application/json" };

// 1) sem login → 401
const r1 = await fetch(`${BASE}/api/montar`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({ briefing: "teste", razaoSocial: "X" }),
});
console.log(`1. montar SEM login        → ${r1.status}  (esperado 401)`);

// 2) login com senha errada → 401
const rbad = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({ login: "mateus", senha: "errada" }),
});
console.log(`2. login senha errada      → ${rbad.status}  (esperado 401)`);

// 3) login correto → cookie de sessão
const r2 = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: json,
  body: JSON.stringify({ login: "mateus", senha: "indeba@2026" }),
});
const setCookie = r2.headers.get("set-cookie") ?? "";
const sessao = setCookie.split(";")[0];
console.log(`3. login mateus correto    → ${r2.status}  cookie=${sessao ? "OK" : "AUSENTE"}`);

// 4) montar COM login → 200
const r3 = await fetch(`${BASE}/api/montar`, {
  method: "POST",
  headers: { ...json, Cookie: sessao },
  body: JSON.stringify({
    briefing: "Cozinha industrial: desengordurante para louças no diluidor automático e álcool gel.",
    razaoSocial: "GVA Alimentos",
    segmento: "cozinha_industrial",
    tipo: "implantacao",
  }),
});
const ok = r3.status === 200;
console.log(`4. montar COM login        → ${r3.status}  (esperado 200)`);

const passou = r1.status === 401 && rbad.status === 401 && r2.status === 200 && sessao && ok;
console.log("=".repeat(48));
console.log(`GATE de autenticação: ${passou ? "✅ FUNCIONANDO" : "❌ FALHOU"}`);
