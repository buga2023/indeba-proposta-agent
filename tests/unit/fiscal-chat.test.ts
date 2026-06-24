import { describe, it, expect } from "vitest";
import { responderFiscal } from "@/lib/financeiro/fiscal-chat";

const ANO = 2026;

describe("cérebro de chat fiscal: responde com memória de cálculo e fonte", () => {
  it("dúvida conceitual: explica o tributo a partir do catálogo", () => {
    const r = responderFiscal("o que é ICMS?", { ano: ANO });
    expect(r.intencao).toBe("duvida_tributaria");
    expect(r.resposta).toMatch(/ICMS/);
    expect(r.fonte).toMatch(/extinção|SEFAZ|transição/i);
  });

  it("comparar regimes: ranqueia e mostra o menor (com contexto)", () => {
    const r = responderFiscal("qual regime paga menos imposto?", { ano: ANO, faturamento: 36865.8, atividade: "comercio" });
    expect(r.intencao).toBe("comparar_regimes");
    expect(r.resposta).toMatch(/simples/);
    expect(r.memoria).toMatch(/carga|%/);
  });

  it("ICMS: apura e devolve a memória de cálculo", () => {
    const r = responderFiscal("quanto de ICMS eu pago?", { ano: ANO, faturamento: 36865.8, compras: 22390.84, regime: "presumido" });
    expect(r.intencao).toBe("icms");
    expect(r.resposta).toMatch(/ICMS a recolher/);
    expect(r.memoria).toMatch(/débito =/);
  });

  it("Simples sem RBT12: PEDE o dado (não inventa)", () => {
    const r = responderFiscal("qual o meu DAS do Simples?", { ano: ANO });
    expect(r.intencao).toBe("simples_das");
    expect(r.resposta).toMatch(/RBT12/);
    expect(r.memoria).toBeNull();
  });

  it("folha: apura encargos com memória", () => {
    const r = responderFiscal("quanto de encargo da folha?", { ano: ANO, folha: 100000 });
    expect(r.intencao).toBe("folha");
    expect(r.resposta).toMatch(/Encargos patronais/);
    expect(r.memoria).toMatch(/Custo total da folha/);
  });

  it("pergunta fora do escopo → oferece o que sabe fazer", () => {
    const r = responderFiscal("bom dia", { ano: ANO });
    expect(r.intencao).toBe("indefinida");
    expect(r.resposta).toMatch(/Simples|ICMS|regimes/);
  });
});
