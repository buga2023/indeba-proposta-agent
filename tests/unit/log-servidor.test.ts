import { describe, expect, it, vi } from "vitest";
import { avisarDegradacao } from "@/lib/log-servidor";

describe("avisarDegradacao", () => {
  it("emite uma linha JSON com tag degradacao, origem, causa e extras", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    avisarDegradacao("catalogo", "banco fora", new Error("ECONNREFUSED"), { codigo: "X1" });
    const linha = JSON.parse(spy.mock.calls[0][0] as string);
    expect(linha).toMatchObject({ nivel: "warn", tag: "degradacao", origem: "catalogo", mensagem: "banco fora", erro: "Error", detalhe: "ECONNREFUSED", codigo: "X1" });
    spy.mockRestore();
  });
});
