/**
 * QA de navegador da REORDENAÇÃO por arrasto na Proposta manual — roda com
 * `pnpm exec vitest run --config vitest.qa.config.ts tests/qa-ordem-arrastar.qa.ts`
 * (fora da suíte unitária: sobe o Next e abre o Chromium do Playwright).
 *
 * Sobe um `next dev` próprio com AUTH_ENABLED=false (o escape local de src/lib/auth.ts) —
 * então NENHUM outro `next dev` pode estar rodando neste diretório, o Next recusa o
 * segundo. Para apontar para um servidor já de pé, exporte QA_BASE_URL.
 *
 * O que prova, na tela de verdade:
 *  1. arrastar a alça reordena a lista (mouse real, não evento sintético);
 *  2. ↑/↓ com a alça em foco também move — quem não usa mouse não fica de fora;
 *  3. a ordem arrastada é a ordem do payload de /api/montar-estruturado, que é a
 *     sequência das páginas do PDF (`scope.itens` é o único portador de ordem);
 *  4. item próprio (fora do catálogo) reordena junto — antes ia sempre para o fim.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";

const PORTA = 3210;
const BASE = process.env.QA_BASE_URL ?? `http://127.0.0.1:${PORTA}`;
const proprio = !process.env.QA_BASE_URL;

let servidor: ChildProcess | null = null;
let browser: Browser;
let page: Page;

async function esperarNoAr(url: string, tentativas = 90) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Servidor não respondeu em ${url}. Há outro "next dev" rodando neste diretório?`);
}

/** Nomes das linhas do painel "Selecionados", de cima para baixo. */
const ordemNaTela = () =>
  page.$$eval('button[aria-label^="Reordenar"]', (alcas) =>
    // Linha = [alça, bloco de texto, quantidade, remover]; o nome é a 1ª linha do bloco.
    alcas.map((a) => a.parentElement?.children[1]?.firstElementChild?.textContent?.trim() ?? ""),
  );

/** Arrasta a alça da linha `de` até o meio da linha `para` com mouse de verdade. */
async function arrastar(de: number, para: number) {
  const alcas = await page.$$('button[aria-label^="Reordenar"]');
  const origem = await alcas[de].boundingBox();
  const destino = await alcas[para].boundingBox();
  if (!origem || !destino) throw new Error("alça sem boundingBox");
  await page.mouse.move(origem.x + origem.width / 2, origem.y + origem.height / 2);
  await page.mouse.down();
  // Passos intermediários: o arrasto reordena a cada movimento, como no uso real.
  const passos = 12;
  for (let i = 1; i <= passos; i++) {
    const t = i / passos;
    await page.mouse.move(destino.x + destino.width / 2, origem.y + (destino.y - origem.y) * t + destino.height / 2);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
}

/** Nomes dos primeiros produtos do catálogo — lidos da tela, não fixados no teste. */
async function primeirosDoCatalogo(n: number): Promise<string[]> {
  const labels = await page.$$eval('button[aria-label^="Adicionar "]', (bs) => bs.map((b) => b.getAttribute("aria-label") ?? ""));
  return labels.slice(0, n).map((l) => l.replace(/^Adicionar /, "").replace(/ à proposta$/, ""));
}

/**
 * Adiciona um produto do catálogo pelo NOME, com tudo resolvido dentro do card dele.
 * Por índice não dá: assim que um produto entra na proposta o aria-label do seu botão
 * muda ("já está na proposta"), a lista de botões encolhe e os índices desalinham dos
 * campos de preço — o teste ia digitar num card e clicar em outro.
 */
async function adicionarDoCatalogo(nome: string, preco: string, diluicao: string) {
  const botao = page.locator(`button[aria-label="Adicionar ${nome} à proposta"]`);
  const card = botao.locator("xpath=.."); // preço, diluição e "+" moram no mesmo card
  await card.locator('input[placeholder="Preço R$"]').fill(preco);
  await card.locator('input[placeholder="ex.: 1:20"]').fill(diluicao);
  await botao.click();
  await page.waitForTimeout(80);
}

beforeAll(async () => {
  if (proprio) {
    servidor = spawn("npx", ["next", "dev", "-H", "127.0.0.1", "-p", String(PORTA)], {
      env: { ...process.env, AUTH_ENABLED: "false" },
      shell: true,
      stdio: "ignore",
    });
  }
  await esperarNoAr(`${BASE}/api/catalogo`);
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByText("Proposta manual", { exact: true }).first().click();
  await page.waitForSelector('input[placeholder="Preço R$"]');

  const [a, b, c] = await primeirosDoCatalogo(3);
  await adicionarDoCatalogo(a, "100", "1:100");
  await adicionarDoCatalogo(b, "200", "1:200");
  await adicionarDoCatalogo(c, "300", "1:300");
}, 300_000);

afterAll(async () => {
  await browser?.close();
  if (servidor?.pid) {
    if (process.platform === "win32") execSync(`taskkill /pid ${servidor.pid} /T /F`, { stdio: "ignore" });
    else servidor.kill("SIGTERM");
  }
});

describe("Proposta manual — ordem dos produtos por arrasto", () => {
  it("três produtos entram na ordem em que foram adicionados, numerados 1..3", async () => {
    const nomes = await ordemNaTela();
    expect(nomes.length).toBe(3);
    const numeros = await page.$$eval('button[aria-label^="Reordenar"]', (a) => a.map((x) => x.textContent?.trim()));
    expect(numeros).toEqual(["1", "2", "3"]);
  });

  it("arrastar a última linha para o topo reordena a lista", async () => {
    const antes = await ordemNaTela();
    await arrastar(2, 0);
    const depois = await ordemNaTela();
    expect(depois).toEqual([antes[2], antes[0], antes[1]]);
  });

  it("arrastar de volta para o fim desfaz — o movimento vale nos dois sentidos", async () => {
    const antes = await ordemNaTela();
    await arrastar(0, 2);
    expect(await ordemNaTela()).toEqual([antes[1], antes[2], antes[0]]);
  });

  it("↑ com a alça em foco move o item para cima (sem mouse)", async () => {
    const antes = await ordemNaTela();
    const alcas = await page.$$('button[aria-label^="Reordenar"]');
    await alcas[2].focus();
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(80);
    expect(await ordemNaTela()).toEqual([antes[0], antes[2], antes[1]]);
  });

  it("item próprio reordena junto com os do catálogo — não fica preso no fim", async () => {
    await page.getByText("Item próprio (fora do catálogo)").first().click();
    await page.locator('input[placeholder="Nome do produto"]').first().fill("Item Proprio QA");
    await page.locator('input[placeholder="Tam."]').first().fill("5");
    // O campo de preço do item próprio é o último "Preço R$" do DOM (vem depois do catálogo).
    const precos = await page.$$('input[placeholder="Preço R$"]');
    await precos[precos.length - 1].fill("50");
    await page.getByRole("button", { name: "Adicionar item" }).first().click();
    await page.waitForTimeout(120);

    const comProprio = await ordemNaTela();
    expect(comProprio[3]).toBe("Item Proprio QA"); // entra no fim...

    // ...e sobe TRÊS posições de uma vez. Guardião do arrasto longo: com a captura de
    // ponteiro presa na alça, o item parava na primeira troca e ficava em 2º lugar.
    await arrastar(3, 0);
    expect(await ordemNaTela()).toEqual(["Item Proprio QA", comProprio[0], comProprio[1], comProprio[2]]);
  });

  it("a ordem da tela é a ordem que chega no documento (payload de /api/montar-estruturado)", async () => {
    const naTela = await ordemNaTela();
    await page.locator('input[placeholder="Ex.: Laticínio São João Ltda"]').first().fill("Cliente QA Ordem");

    const [resposta] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/montar-estruturado") && r.status() === 200),
      page.getByRole("button", { name: /Montar proposta/ }).first().click(),
    ]);
    const scope = await resposta.json();
    const noPayload: string[] = scope.itens.map((i: { nome: string }) => i.nome);

    // Mesma sequência, item a item — é ela que vira a ordem das páginas do PDF.
    expect(noPayload).toEqual(naTela);
    expect(noPayload[0]).toBe("Item Proprio QA"); // o que foi arrastado para o topo
  }, 120_000);
});
