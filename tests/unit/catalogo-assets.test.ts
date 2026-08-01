import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";

const PUBLIC = path.resolve(import.meta.dirname, "../../public");

// Teste-guardião do catálogo em linha. Contexto: 141 dos 150 produtos ficaram com
// `ativo: false` depois da importação da base INDEBA/PRATT — a tela de Catálogo lista só
// `ativo`, então o catálogo escondia 94% de si mesmo e o líder da Indeba via 9 produtos.
// `ativo` é flag de NEGÓCIO ("está em linha"), não lixeira de importação: produto importado
// nasce ativo se tem asset, e arquivar é ato deliberado (ver scripts/ativar-catalogo.mjs).
//
// Isto aqui não é só sobre a vitrine: `ativo` também governa a seleção automática
// (src/lib/selecao/matcher.ts), o índice RAG (src/lib/rag/indexar.ts) e a lista que a IA
// pode citar no comando de edição. Produto ativo sem foto ou sem ficha vaza para o PDF e
// para a proposta como buraco — daí a barreira ser em disco, não no JSON.
describe("catálogo — todo produto em linha tem asset de verdade", () => {
  const catalogo = carregarCatalogo();

  it("GUARDIÃO: todo produto ativo tem foto E ficha técnica existentes em disco", () => {
    const semAsset = catalogo.produtos
      .filter((p) => p.ativo)
      .map((p) => ({
        codigo: p.codigo,
        foto: p.imagemPath && existsSync(path.join(PUBLIC, p.imagemPath)),
        ficha: p.fichaTecnicaPath && existsSync(path.join(PUBLIC, p.fichaTecnicaPath)),
      }))
      .filter((x) => !x.foto || !x.ficha);

    expect(semAsset).toEqual([]);
  });

  // Os pares SPAR-HT2/SPAR-HT-2, SPAR-HT3/SPAR-HT-3 e PRATT-ALCOOL-GEL/PRATT-ALCOOL-GEL-70
  // são o mesmo produto com o código grafado de dois jeitos (cada par compartilha o MESMO
  // PDF de ficha). Ficaram os códigos da importação, com nome e foto reais; os do seed
  // saíram de linha. Se voltarem, o Pratt Álcool Gel aparece duplicado na tela de novo.
  it("GUARDIÃO: as duplicatas do seed continuam fora de linha", () => {
    for (const codigo of ["SPAR-HT2", "SPAR-HT3", "PRATT-ALCOOL-GEL"]) {
      expect(catalogo.produtos.find((p) => p.codigo === codigo)?.ativo).toBe(false);
    }
    // e a contraparte que ficou é a que tem a foto de estúdio, não a arte
    const pratt = catalogo.produtos.find((p) => p.codigo === "PRATT-ALCOOL-GEL-70");
    expect(pratt?.ativo).toBe(true);
    expect(pratt?.imagemPath).toBe("/produtos/pratt-alcool-gel-70.png");
  });

  it("GUARDIÃO: nenhum código repetido no catálogo", () => {
    const vistos = new Set<string>();
    const repetidos = catalogo.produtos.map((p) => p.codigo).filter((c) => !vistos.add(c));
    expect(repetidos).toEqual([]);
  });
});
