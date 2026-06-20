import { describe, it, expect } from "vitest";
import { porPalavraChave, unirFacetas } from "@/lib/llm/extrair-pedido";
import type { FacetasDetectadas } from "@/lib/contracts";

// Estes três briefings são exatamente os que o spike do Qwen 7B errou.
// O pré-passo determinístico tem que ancorar o que o LLM perdeu/inventou.
describe("pré-passo determinístico de facetas (§1.1 backbone determinístico)", () => {
  it("briefing 1: ancora segmento=laticinio e função=cip (o 7B errou ambos)", () => {
    const f = porPalavraChave(
      "Laticínio Taquipe, limpeza CIP das linhas de produção, desinfecção e sabonete para os colaboradores.",
    );
    expect(f.segmento).toContain("laticinio"); // 7B devolveu industria_bebidas
    expect(f.funcao).toContain("cip"); // 7B perdeu, mesmo com "CIP" no texto
    expect(f.funcao).toContain("desinfetante");
    expect(f.linha).toContain("alimentos_bebidas");
  });

  it("briefing 3: pega hortifruti + desinfetante (o 7B deixou incompleto)", () => {
    const f = porPalavraChave(
      "Distribuidora de hortifruti, multiuso pra limpeza geral e desinfetante pras câmaras frias, com diluidor automático.",
    );
    expect(f.segmento).toContain("hortifruti"); // 7B devolveu vazio
    expect(f.funcao).toEqual(expect.arrayContaining(["multiuso", "desinfetante"]));
    expect(f.metodo).toContain("diluidor_automatico");
  });

  it("briefing 4: desincrustante + cip, sem inventar lavanderia (o 7B inventou)", () => {
    const f = porPalavraChave(
      "Indústria de bebidas, remoção de incrustação nos tanques por circulação CIP.",
    );
    expect(f.funcao).toEqual(expect.arrayContaining(["desincrustante", "cip"]));
    expect(f.metodo).toContain("circulacao_cip");
    expect(f.linha).not.toContain("lavanderia"); // o 7B alucinou essa linha
  });
});

describe("unirFacetas — IA complementa, não substitui", () => {
  it("une por grupo sem duplicar; o determinístico entra primeiro", () => {
    const det: FacetasDetectadas = {
      linha: ["alimentos_bebidas"],
      segmento: ["laticinio"],
      funcao: ["cip"],
      metodo: [],
    };
    const ia: FacetasDetectadas = {
      linha: ["alimentos_bebidas"],
      segmento: [],
      funcao: ["desinfetante"],
      metodo: ["circulacao_cip"],
    };
    const u = unirFacetas(det, ia);
    expect(u.linha).toEqual(["alimentos_bebidas"]); // sem duplicar
    expect(u.funcao).toEqual(["cip", "desinfetante"]); // determinístico ancora, IA soma
    expect(u.segmento).toEqual(["laticinio"]);
    expect(u.metodo).toEqual(["circulacao_cip"]);
  });
});
