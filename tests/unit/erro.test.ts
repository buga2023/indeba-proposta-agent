import { describe, expect, it, vi } from "vitest";
import { registroDeErro, respostaErro } from "@/lib/erro";

describe("respostaErro — log estruturado, resposta curada", () => {
  it("devolve só a mensagem pública ao cliente", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = respostaErro(new Error("segredo do banco"), "Falha ao salvar.", 500);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ erro: "Falha ao salvar." });
    expect(spy).toHaveBeenCalledTimes(1);
    const linha = JSON.parse(spy.mock.calls[0][0] as string);
    expect(linha).toMatchObject({ nivel: "error", origem: "api", mensagem: "Falha ao salvar.", status: 500, erro: "Error", detalhe: "segredo do banco" });
    expect(Array.isArray(linha.stack)).toBe(true);
    spy.mockRestore();
  });

  it("status < 500 vira warn; erro não-Error vira string truncada", () => {
    const reg = registroDeErro("x".repeat(600), "Ruim", 400);
    expect(reg.nivel).toBe("warn");
    expect(reg.erro).toBe("string");
    expect(reg.detalhe).toHaveLength(500);
    expect(reg.stack).toEqual([]);
  });
});
