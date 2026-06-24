import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mocks das dependências da rota: a sessão (papel) e o disparo real (não toca n8n).
const usuarioAtual = vi.fn();
const dispararCobranca = vi.fn();
vi.mock("@/lib/chamados", () => ({ usuarioAtual: (req: NextRequest) => usuarioAtual(req) }));
vi.mock("@/lib/contatos", () => ({ dispararCobranca: (...a: unknown[]) => dispararCobranca(...a) }));

import { POST } from "@/app/api/cobranca/disparar/route";

const req = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;

const inadimplente = {
  cliente: "Acme",
  valorDevido: "100.00",
  titulos: 1,
  vencimentoMaisAntigo: "2026-01-01",
  diasAtraso: 30,
  severidade: "grave",
  mensagem: "Prezado, consta título em aberto.",
  email: "fin@acme.com",
};

beforeEach(() => {
  usuarioAtual.mockReset();
  dispararCobranca.mockReset();
});

describe("POST /api/cobranca/disparar — hardening do open-relay", () => {
  it("401 quando não autenticado", async () => {
    usuarioAtual.mockResolvedValue(null);
    const r = await POST(req({ inadimplentes: [inadimplente] }));
    expect(r.status).toBe(401);
    expect(dispararCobranca).not.toHaveBeenCalled();
  });

  it("403 quando autenticado mas NÃO admin (envia e-mail em nome da empresa)", async () => {
    usuarioAtual.mockResolvedValue({ login: "mateus", papel: "user" });
    const r = await POST(req({ inadimplentes: [inadimplente] }));
    expect(r.status).toBe(403);
    expect(dispararCobranca).not.toHaveBeenCalled();
  });

  it("400 quando o body não bate com o schema (corpo/destinatário arbitrário barrado)", async () => {
    usuarioAtual.mockResolvedValue({ login: "gustavo", papel: "admin" });
    // payload de open-relay: destinatário/corpo crus, sem a estrutura do motor
    const r = await POST(req({ inadimplentes: [{ to: "vitima@x.com", corpo: "spam" }] }));
    expect(r.status).toBe(400);
    expect(dispararCobranca).not.toHaveBeenCalled();
  });

  it("400 quando a lista está vazia", async () => {
    usuarioAtual.mockResolvedValue({ login: "gustavo", papel: "admin" });
    const r = await POST(req({ inadimplentes: [] }));
    expect(r.status).toBe(400);
  });

  it("admin + body válido → dispara", async () => {
    usuarioAtual.mockResolvedValue({ login: "gustavo", papel: "admin" });
    dispararCobranca.mockResolvedValue({ enviados: 1 });
    const r = await POST(req({ inadimplentes: [inadimplente], totalDevido: "100.00" }));
    expect(r.status).toBe(200);
    expect(dispararCobranca).toHaveBeenCalledOnce();
    expect(await r.json()).toMatchObject({ ok: true, enviados: 1 });
  });
});
