import { describe, it, expect } from "vitest";
import { paginaProduto } from "@/lib/pdf/template-consolidada";
import { tamanhoLegivel } from "@/lib/embalagem";
import type { PropostaItem } from "@/lib/contracts";

// Rodada de ajustes da ficha de produto (29/07, WhatsApp do Matheus sobre a proposta do
// Farid): (a) "adc em alguns casos a informação de embalagem cotada" — produto de tamanho
// ÚNICO saía sem painel de embalagem nenhum, então a página não dizia em lugar algum qual
// era a embalagem cotada; (b) o tamanho quebrado saía com ponto decimal ("5.3 kg").

const item = (over: Partial<PropostaItem> = {}): PropostaItem => ({
  codigo: "X",
  nome: "Produto X",
  descricaoUso: "uso",
  imagemPath: "/produtos/x.png",
  embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
  ficha: null,
  tamanhosDisponiveis: [],
  fichaTecnicaPath: null,
  quantidade: 1,
  procedenciaSelecao: "MANUAL",
  motivo: "",
  ...over,
});

describe("tamanhoLegivel — o tamanho que o cliente lê", () => {
  it("inteiro sai sem casas decimais", () => {
    expect(tamanhoLegivel(5, "L")).toBe("5 L");
    expect(tamanhoLegivel(800, "ml")).toBe("800 ml");
  });

  it("quebrado sai com VÍRGULA (o caso Primmax Hort FLV: era '5.3 kg')", () => {
    expect(tamanhoLegivel(5.3, "kg")).toBe("5,3 kg");
    expect(tamanhoLegivel(6.2, "kg")).toBe("6,2 kg");
  });

  it("milhar sai com ponto separador — IBC de 1.240 kg", () => {
    expect(tamanhoLegivel(1240, "kg")).toBe("1.240 kg");
  });
});

describe("ficha de produto — a embalagem cotada aparece SEMPRE", () => {
  it("tamanho único: painel 'Embalagem cotada' com o selo (antes não saía painel nenhum)", () => {
    const html = paginaProduto(
      item({ embalagens: [{ tamanho: 5.3, unidade: "kg", preco: "69.00", diluicaoMax: null, custoDiluido: null }] }),
      "",
    );
    expect(html).toContain("Embalagem cotada");
    expect(html).not.toContain("Embalagens disponíveis"); // plural, para uma linha só, lê mal
    expect(html).toContain("pp-emb-cotada");
    expect(html).toContain("5,3 kg");
  });

  it("vários tamanhos: painel continua 'Embalagens disponíveis', com UM selo de cotada", () => {
    const html = paginaProduto(
      item({
        embalagens: [{ tamanho: 5, unidade: "L", preco: "99.00", diluicaoMax: null, custoDiluido: null }],
        tamanhosDisponiveis: [
          { tamanho: 5, unidade: "L" },
          { tamanho: 23, unidade: "kg" },
          { tamanho: 58, unidade: "kg" },
        ],
      }),
      "",
    );
    expect(html).toContain("Embalagens disponíveis");
    expect(html.match(/pp-emb-cotada/g)).toHaveLength(1);
    expect(html.match(/pp-emb-chip/g)).toHaveLength(3);
  });

  it("GUARDIÃO: nenhum tamanho sai com ponto decimal na página (nem no Valor, nem no chip)", () => {
    const html = paginaProduto(
      item({ embalagens: [{ tamanho: 5.3, unidade: "kg", preco: "69.00", diluicaoMax: null, custoDiluido: null }] }),
      "",
    );
    expect(html).not.toMatch(/\d\.\d\s*(kg|L|ml)\b/);
  });
});
