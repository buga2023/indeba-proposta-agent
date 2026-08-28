import { test, expect } from "@playwright/test";

// Smoke dos anexos das ferramentas (áudio do Mateus, 27/08/2026): as rotas novas existem
// e continuam FECHADAS para anônimo — mesmo desenho do producao-smoke.spec.ts.
test("POST de anexo anônimo é barrado", async ({ request }) => {
  const r = await request.post("/api/anexos", {
    multipart: {
      registroTipo: "prospeccao",
      registroId: "qualquer-id",
      categoria: "foto",
      arquivo: { name: "x.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    },
  });
  expect([401, 403, 307]).toContain(r.status());
});

test("GET de anexo anônimo é barrado", async ({ request }) => {
  const r = await request.get("/api/anexos/qualquer-id");
  expect([401, 403, 307, 404]).toContain(r.status());
});

test("DELETE de anexo anônimo é barrado", async ({ request }) => {
  const r = await request.delete("/api/anexos?id=qualquer-id");
  expect([401, 403, 307, 404]).toContain(r.status());
});

test("DELETE de foto de visita anônimo é barrado", async ({ request }) => {
  const r = await request.delete("/api/visitas/qualquer-id/fotos/qualquer-foto");
  expect([401, 403, 307, 404]).toContain(r.status());
});

test("DELETE de documento de visita anônimo é barrado", async ({ request }) => {
  const r = await request.delete("/api/visitas/qualquer-id/documento");
  expect([401, 403, 307, 404]).toContain(r.status());
});
