import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Transferência de carteira (áudio do Mateus, 02/09/2026: "lancei ontem uma proposta e
 * não consigo transferir para ele"). O que este teste guarda é QUEM pode transferir — o
 * mesmo portão do status, porque mover proposta entre carteiras é ação de gestão.
 */

const usuarioAtual = vi.fn();
const autorDaProposta = vi.fn();
const transferirProposta = vi.fn();
const atualizarStatusProposta = vi.fn();

vi.mock("@/lib/auth-db", () => ({ usuarioAtual: (req: NextRequest) => usuarioAtual(req) }));
vi.mock("@/lib/propostas", () => ({
  obterProposta: vi.fn(),
  autorDaProposta: (...a: unknown[]) => autorDaProposta(...a),
  atualizarStatusProposta: (...a: unknown[]) => atualizarStatusProposta(...a),
  transferirProposta: (...a: unknown[]) => transferirProposta(...a),
  ConsultorInexistenteError: class ConsultorInexistenteError extends Error {},
  autorEStatusDaProposta: vi.fn(),
  excluirPropostaDefinitivamente: vi.fn(),
}));

import { PATCH } from "@/app/api/propostas/[id]/route";
import { ConsultorInexistenteError } from "@/lib/propostas";

const ADMIN = { email: "mateus@indeba.com", papel: "admin" };
const VENDEDOR = { email: "a@indeba.com", papel: "user" };
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;

beforeEach(() => {
  for (const m of [usuarioAtual, autorDaProposta, transferirProposta, atualizarStatusProposta]) m.mockReset();
  autorDaProposta.mockResolvedValue("a@indeba.com");
  transferirProposta.mockResolvedValue({ id: "p-1", autor: "austin@indeba.com" });
});

describe("PATCH /api/propostas/[id] — transferência de consultor", () => {
  it("admin transfere: chama a persistência com o e-mail do destino", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    const r = await PATCH(req({ autor: "austin@indeba.com" }), params("p-1"));
    expect(r.status).toBe(200);
    expect(transferirProposta).toHaveBeenCalledWith("p-1", "austin@indeba.com");
    // Transferir não é mudar status — o outro caminho do PATCH fica intocado.
    expect(atualizarStatusProposta).not.toHaveBeenCalled();
  });

  it("vendedor na PRÓPRIA proposta → 403 e nada é transferido", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    const r = await PATCH(req({ autor: "austin@indeba.com" }), params("p-1"));
    expect(r.status).toBe(403);
    expect(transferirProposta).not.toHaveBeenCalled();
  });

  it("destino fora do cadastro → 422, sem proposta órfã", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    transferirProposta.mockRejectedValue(new ConsultorInexistenteError());
    const r = await PATCH(req({ autor: "ninguem@indeba.com" }), params("p-1"));
    expect(r.status).toBe(422);
  });

  it("e-mail inválido no corpo → 400 antes de tocar o banco", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    const r = await PATCH(req({ autor: "não-é-email" }), params("p-1"));
    expect(r.status).toBe(400);
    expect(transferirProposta).not.toHaveBeenCalled();
  });

  it("status continua funcionando pelo mesmo PATCH", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    atualizarStatusProposta.mockResolvedValue({ id: "p-1", status: "aprovada" });
    const r = await PATCH(req({ status: "aprovada" }), params("p-1"));
    expect(r.status).toBe(200);
    expect(atualizarStatusProposta).toHaveBeenCalledWith("p-1", "aprovada");
    expect(transferirProposta).not.toHaveBeenCalled();
  });
});
