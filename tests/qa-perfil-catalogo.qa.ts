// QA de navegador dos ajustes de 01/08/2026 (catálogo liberado + dashboard + escopo por
// perfil). Sobe o Chromium do Playwright contra um dev server REAL, com sessões assinadas
// de verdade — é a única forma de provar o que o gestor vai olhar: o que cada papel vê.
//
// NÃO roda na suíte (extensão .qa.ts, fora do include do vitest). Precisa de dev server COM
// auth ativa e banco no ar:
//
//   pnpm db:up && pnpm dev                       # noutro terminal
//   BASE=http://localhost:3000 npx vitest run --config vitest.qa.config.ts tests/qa-perfil-catalogo.qa.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { criarSessao } from "@/lib/auth";
import { prisma } from "@/lib/db";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ORIGEM = new URL(BASE).origin;

const ADMIN = { email: "qa-admin@indeba.test", nome: "QA Gestor", papel: "admin" as const };
const VENDEDOR_A = { email: "qa-vendedor-a@indeba.test", nome: "QA Vendedor A", papel: "user" as const };
const VENDEDOR_B = { email: "qa-vendedor-b@indeba.test", nome: "QA Vendedor B", papel: "user" as const };

let browser: Browser;

// Sessão assinada com o mesmo segredo do servidor — o cookie é autocontido e validarSessao
// nunca consulta o banco, então dá pra encarnar um papel sem cadastrar usuário.
async function abrirComo(u: typeof ADMIN | typeof VENDEDOR_A): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.addCookies([{ name: "sessao", value: await criarSessao(u), url: ORIGEM, httpOnly: true }]);
  const page = await ctx.newPage();
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  (page as Page & { _erros: string[] })._erros = erros;
  return page;
}
const errosDe = (p: Page) => (p as Page & { _erros: string[] })._erros;

async function api(u: typeof ADMIN, caminho: string, init: RequestInit = {}) {
  const cookie = `sessao=${await criarSessao(u)}`;
  return fetch(`${BASE}${caminho}`, { ...init, headers: { ...(init.headers ?? {}), Cookie: cookie, "Content-Type": "application/json" } });
}

beforeAll(async () => {
  const r = await fetch(`${BASE}/api/login`, { method: "POST" }).catch(() => null);
  if (!r) throw new Error(`dev server fora do ar em ${BASE} — suba com "pnpm dev" antes`);

  // Os três precisam EXISTIR e estar aprovados no banco. Desde o portão de aprovação
  // (01/08/2026) o /api/me confere o acesso no Postgres a cada carregamento, então um
  // cookie assinado para um e-mail que não existe é derrubado — que é o comportamento
  // certo (conta apagada perde acesso na hora), mas exige semear o cenário aqui.
  for (const u of [ADMIN, VENDEDOR_A, VENDEDOR_B]) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      create: { email: u.email, nome: u.nome, credencial: "qa", papel: u.papel, acesso: "aprovado" },
      update: { papel: u.papel, acesso: "aprovado" },
    });
  }
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await prisma.proposta.deleteMany({ where: { autor: { endsWith: "@indeba.test" } } });
  await prisma.usuario.deleteMany({ where: { email: { endsWith: "@indeba.test" } } });
  await browser?.close();
  await prisma.$disconnect();
});

// ── M1 + M6: o catálogo real inteiro está na tela ──────────────────────────────
describe("Catálogo — o que o gestor reclamou que não aparecia", () => {
  it("o filtro 'Todos' lista os 147 produtos em linha (era 9 de 150)", async () => {
    const page = await abrirComo(VENDEDOR_A);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Catálogo" }).first().click();
    await page.waitForTimeout(800);

    const sub = await page.locator("body").innerText();
    expect(sub).toContain("147 produtos");

    // os chips de linha derivam dos ativos: com o catálogo escondido só apareciam 3-4
    for (const linha of ["Automotiva", "Alimentos Bebidas", "Lavanderia", "Tratamento Pisos", "Higiene Clinica"]) {
      expect(sub, `chip da linha ${linha}`).toContain(linha);
    }
    expect(errosDe(page)).toEqual([]);
    await page.close();
  });

  it("o Pratt Álcool Gel aparece UMA vez na navegação, com a foto de estúdio", async () => {
    const page = await abrirComo(VENDEDOR_A);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Catálogo" }).first().click();
    await page.waitForTimeout(800);
    // Sem busca, o filtro esconde o arquivado: só o -70 (foto real) fica de pé.
    // O `exact` importa — a command palette mantém os dois no DOM (com hint "· arquivado"),
    // e é a TABELA que o gestor olha quando reclamou de ver o produto duplicado.
    const linhas = await page.locator('input[placeholder*="SKU"]').locator("xpath=../..").innerText();
    const naTabela = (await page.locator("body").innerText())
      .split("\n")
      .filter((l) => l.trim() === "PRATT-ALCOOL-GEL" || l.trim() === "PRATT-ALCOOL-GEL-70");
    expect(naTabela, `contexto: ${linhas.slice(0, 40)}`).toEqual(["PRATT-ALCOOL-GEL-70"]);

    // e a foto que vai para a tela é a de estúdio, não a arte de 42 KB
    const img = page.locator('img[src*="pratt-alcool-gel"]').first();
    expect(await img.getAttribute("src")).toContain("pratt-alcool-gel-70");
    await page.close();
  });
});

// ── M2: a busca acha o produto que existe ──────────────────────────────────────
describe("Busca do catálogo — os produtos que ele procurou e não achou", () => {
  const casos = [
    { termo: "subzero", esperado: "PRIMMAX-SUBZERO", porque: "estava arquivado; a busca agora atravessa o filtro" },
    { termo: "dg clor", esperado: "PRIMMAX-DGCLOR", porque: "ATIVO o tempo todo — só o separador não casava" },
    { termo: "spar ht 2", esperado: "SPAR-HT-2", porque: "idem: espaço no lugar do hífen" },
    { termo: "álcool gel", esperado: "PRATT-ALCOOL-GEL-70", porque: "acento no termo, sem acento no código" },
    { termo: "PRIMMAX-PLUS", esperado: "PRIMMAX-PLUS", porque: "busca por SKU exato continua funcionando" },
  ];

  for (const { termo, esperado, porque } of casos) {
    it(`"${termo}" acha ${esperado} — ${porque}`, async () => {
      const page = await abrirComo(VENDEDOR_A);
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Catálogo" }).first().click();
      await page.waitForTimeout(700);
      await page.locator('input[placeholder*="SKU"]').fill(termo);
      await page.waitForTimeout(500);

      const corpo = await page.locator("body").innerText();
      expect(corpo).toContain(esperado);
      expect(corpo, "subtítulo deve falar em resultados, não em contagem de categoria").toMatch(/resultados? para/);
      await page.close();
    });
  }

  it("termo sem correspondência não inventa resultado", async () => {
    const page = await abrirComo(VENDEDOR_A);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Catálogo" }).first().click();
    await page.waitForTimeout(700);
    await page.locator('input[placeholder*="SKU"]').fill("xyzabc123");
    await page.waitForTimeout(500);
    expect(await page.locator("body").innerText()).toContain("0 resultados");
    await page.close();
  });
});

// ── M3 + M4 + M5.3: cada papel vê o seu painel ────────────────────────────────
describe("Dashboard — o painel do vendedor e o do gestor", () => {
  it("vendedor: 4 KPIs com Recusadas, sem catálogo, sem Atividade recente, sem Configurações", async () => {
    const page = await abrirComo(VENDEDOR_A);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const kpis = (await page.locator(".ies-kpi > *").allInnerTexts()).map((t) => t.split("\n")[0]);
    expect(kpis).toEqual(["Propostas", "Valor total", "Aprovadas", "Recusadas"]);

    const corpo = await page.locator("body").innerText();
    expect(corpo, "gráfico de barras zeradas saiu").not.toContain("Propostas por tipo");
    expect(corpo, "o donut fica").toContain("Propostas por status");
    expect(corpo, "atividade recente é do gestor").not.toContain("Atividade recente");
    expect(corpo, "o financeiro fica — é a carteira dele").toContain("Valor aprovado");
    expect(corpo, "painel do gestor não aparece no menu").not.toContain("Configurações");
    expect(errosDe(page)).toEqual([]);
    await page.close();
  });

  it("gestor: 5 KPIs (com catálogo), Atividade recente e Configurações", async () => {
    const page = await abrirComo(ADMIN);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const kpis = (await page.locator(".ies-kpi > *").allInnerTexts()).map((t) => t.split("\n")[0]);
    expect(kpis).toEqual(["Propostas", "Valor total", "Aprovadas", "Recusadas", "Produtos no catálogo"]);

    const corpo = await page.locator("body").innerText();
    expect(corpo).toContain("Atividade recente");
    expect(corpo).toContain("Configurações");
    expect(corpo).not.toContain("Propostas por tipo");
    expect(errosDe(page)).toEqual([]);
    await page.close();
  });

  it("o KPI do catálogo mostra a contagem real, não '—'", async () => {
    const page = await abrirComo(ADMIN);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const card = await page.locator(".ies-kpi > *").last().innerText();
    expect(card).toMatch(/Produtos no catálogo\s+150/);
    await page.close();
  });
});

// ── M5.3: esconder no menu sem esconder no Ctrl+K seria não esconder ──────────
describe("Command palette — o atalho não pode contornar o menu", () => {
  it("vendedor: Ctrl+K não oferece Configurações", async () => {
    const page = await abrirComo(VENDEDOR_A);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);
    await page.keyboard.type("config");
    await page.waitForTimeout(400);
    expect(await page.locator("body").innerText()).not.toContain("Configurações");
    await page.close();
  });

  it("gestor: Ctrl+K oferece Configurações", async () => {
    const page = await abrirComo(ADMIN);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);
    await page.keyboard.type("config");
    await page.waitForTimeout(400);
    expect(await page.locator("body").innerText()).toContain("Configurações");
    await page.close();
  });

  it("a paleta encontra produto do catálogo por SKU (inclusive os recém-liberados)", async () => {
    const page = await abrirComo(VENDEDOR_A);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);
    await page.keyboard.type("subzero");
    await page.waitForTimeout(500);
    expect(await page.locator("body").innerText()).toContain("Subzero");
    await page.close();
  });
});

// ── M5.1 + M5.2 + M5.2b: isolamento de dados de verdade, no servidor ──────────
describe("API de propostas — vendedor não alcança a carteira do colega", () => {
  const idDeB = `qa-escopo-${Date.now()}`;
  const scopeDeB = {
    id: idDeB, criadoEm: new Date().toISOString(), status: "rascunho",
    tipo: "consolidada", template: "indeba_express",
    cliente: { razaoSocial: "QA Cliente do B", cnpj: null, segmento: null, responsavel: null },
    textoApresentacao: { conteudo: "qa", procedencia: "MANUAL" },
    itens: [{ codigo: "PRIMMAX-PLUS", nome: "Primmax Plus", descricaoUso: "u", imagemPath: "/produtos/primmax-plus.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "123.45", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: null }],
    condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  };

  beforeAll(async () => {
    const r = await api(VENDEDOR_B as never, "/api/propostas", { method: "POST", body: JSON.stringify(scopeDeB) });
    expect(r.status, "o vendedor B precisa conseguir criar a própria proposta").toBe(201);
    expect((await r.json()).autor).toBe(VENDEDOR_B.email);
  }, 30_000);

  it("A não recebe a proposta de B na listagem", async () => {
    const { propostas } = await (await api(VENDEDOR_A as never, "/api/propostas")).json();
    expect(propostas.some((p: { id: string }) => p.id === idDeB)).toBe(false);
    expect(propostas.every((p: { autor: string }) => p.autor === VENDEDOR_A.email)).toBe(true);
  });

  it("o gestor recebe a proposta de B na listagem", async () => {
    const { propostas } = await (await api(ADMIN, "/api/propostas")).json();
    expect(propostas.some((p: { id: string }) => p.id === idDeB)).toBe(true);
  });

  it("A abrindo a proposta de B pelo id → 404 (e não 403, que confirmaria a existência)", async () => {
    const r = await api(VENDEDOR_A as never, `/api/propostas/${idDeB}`);
    expect(r.status).toBe(404);
    expect((await r.json()).erro).toBe("Proposta não encontrada.");
  });

  it("o gestor abre a proposta de B → 200", async () => {
    expect((await api(ADMIN, `/api/propostas/${idDeB}`)).status).toBe(200);
  });

  it("A mudando o status da proposta de B → 404 e o status NÃO muda", async () => {
    const r = await api(VENDEDOR_A as never, `/api/propostas/${idDeB}`, { method: "PATCH", body: JSON.stringify({ status: "recusada" }) });
    expect(r.status).toBe(404);
    const depois = await (await api(ADMIN, `/api/propostas/${idDeB}`)).json();
    expect(depois.status, "o status tem que continuar como estava").toBe("rascunho");
  });

  it("A reenviando o scope com o id de B NÃO sobrescreve a proposta dele", async () => {
    const sequestro = { ...scopeDeB, cliente: { ...scopeDeB.cliente, razaoSocial: "SEQUESTRADO PELO A" } };
    const r = await api(VENDEDOR_A as never, "/api/propostas", { method: "POST", body: JSON.stringify(sequestro) });
    expect(r.status).toBe(404);
    const depois = await (await api(ADMIN, `/api/propostas/${idDeB}`)).json();
    expect(depois.cliente).toBe("QA Cliente do B");
    expect(depois.autor).toBe(VENDEDOR_B.email);
  });

  it("B continua dono da própria proposta e consegue editá-la", async () => {
    const r = await api(VENDEDOR_B as never, "/api/propostas", {
      method: "POST",
      body: JSON.stringify({ ...scopeDeB, cliente: { ...scopeDeB.cliente, razaoSocial: "QA Cliente do B (editado)" } }),
    });
    expect(r.status).toBe(201);
    expect((await r.json()).cliente).toBe("QA Cliente do B (editado)");
  });
});

// ── O catálogo liberado não pode quebrar o que já funcionava ─────────────────
describe("Regressão — o catálogo maior não derruba montagem nem PDF", () => {
  it("a rota de catálogo serve os 150 e continua com ETag/304", async () => {
    const r = await api(ADMIN, "/api/catalogo");
    expect(r.status).toBe(200);
    const etag = r.headers.get("etag");
    expect(etag).toBeTruthy();
    const { produtos } = await r.json();
    expect(produtos.length).toBe(150);
    expect(produtos.filter((p: { ativo: boolean }) => p.ativo).length).toBe(147);

    const r304 = await fetch(`${BASE}/api/catalogo`, {
      headers: { Cookie: `sessao=${await criarSessao(ADMIN)}`, "If-None-Match": etag! },
    });
    expect(r304.status, "revalidação por ETag continua economizando o payload").toBe(304);
  });

  it("a montagem manual gera PDF com um produto que estava arquivado até hoje", async () => {
    const scope = {
      id: `qa-pdf-${Date.now()}`, criadoEm: new Date().toISOString(), status: "rascunho",
      tipo: "consolidada", template: "indeba_express",
      cliente: { razaoSocial: "QA Subzero", cnpj: null, segmento: null, responsavel: null },
      textoApresentacao: { conteudo: "qa", procedencia: "MANUAL" },
      itens: [{ codigo: "PRIMMAX-SUBZERO", nome: "Primmax Subzero", descricaoUso: "uso", imagemPath: "/produtos/primmax-subzero.png",
        embalagens: [{ tamanho: 5, unidade: "L", preco: "200.00", diluicaoMax: null, custoDiluido: null }],
        quantidade: 2, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: null }],
      condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
    };
    const r = await api(ADMIN, "/api/pdf", { method: "POST", body: JSON.stringify(scope) });
    expect(r.status).toBe(200);
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(0, 4).toString(), "resposta tem que ser um PDF").toBe("%PDF");
    expect(buf.length).toBeGreaterThan(20_000);
  }, 180_000);
});
