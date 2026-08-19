import { test, expect } from "@playwright/test";

// Smoke da PRODUÇÃO após o deploy do a029afc (QA do Mateus, 18/08):
// o app está de pé, o login aparece e a API continua fechada para anônimo.
test("produção está no ar e mostra a tela de login", async ({ page }) => {
  const r = await page.goto("/");
  expect(r?.status()).toBe(200);
  await expect(page.locator("input[type=password]")).toBeVisible({ timeout: 15_000 });
});

test("API de propostas não vaza nada para anônimo", async ({ request }) => {
  const r = await request.get("/api/propostas");
  // Sem sessão o recorte por autor devolve lista vazia ou o middleware barra — nunca dados.
  if (r.ok()) {
    const body = await r.json();
    expect(body.propostas ?? []).toHaveLength(0);
  } else {
    expect([401, 403, 307]).toContain(r.status());
  }
});

test("PATCH de status anônimo não muda nada", async ({ request }) => {
  const r = await request.patch("/api/propostas/qualquer-id", { data: { status: "aprovada" } });
  expect([401, 403, 404, 400]).toContain(r.status());
});

test("DELETE definitivo anônimo é barrado", async ({ request }) => {
  const r = await request.delete("/api/propostas/qualquer-id");
  expect([401, 403, 404]).toContain(r.status());
});
