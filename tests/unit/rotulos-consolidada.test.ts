import { describe, it, expect } from "vitest";
import { consolidadaDefaults, rotulosConsolidada, ROTULOS_PADRAO } from "@/lib/consolidada-defaults";
import { setRotuloConsolidada } from "@/lib/proposta-edit";
import { ConsolidadaBloco } from "@/lib/contracts";
import type { PropostaScope } from "@/lib/contracts";

const scopeCom = (consolidada = consolidadaDefaults()) => ({ consolidada }) as unknown as PropostaScope;

describe("rótulos editáveis da Proposta de Solução", () => {
  it("sem rotulos ou vazio, usa o padrão", () => {
    expect(rotulosConsolidada(consolidadaDefaults())).toEqual(ROTULOS_PADRAO);
    expect(rotulosConsolidada({ rotulos: { comodatosTitulo: "   " } }).comodatosTitulo).toBe("Comodatos Oferecidos");
  });

  it("edição por proposta sobrescreve e é imutável", () => {
    const s = scopeCom();
    const novo = setRotuloConsolidada(s, "comodatosTitulo", "Tecnologia Oferecida");
    expect(rotulosConsolidada(novo.consolidada).comodatosTitulo).toBe("Tecnologia Oferecida");
    expect(s.consolidada?.rotulos).toBeUndefined();
  });

  it("sobrevive ao parse do contrato (persistência) e proposta antiga sem rotulos continua válida", () => {
    const novo = setRotuloConsolidada(scopeCom(), "tituloProposta", "Proposta Técnica");
    expect(ConsolidadaBloco.parse(novo.consolidada).rotulos?.tituloProposta).toBe("Proposta Técnica");
    expect(ConsolidadaBloco.parse(consolidadaDefaults()).rotulos).toBeUndefined();
  });
});

describe("títulos de seção (09/10/2026)", () => {
  it("todas as seções têm rótulo padrão e aceitam troca", () => {
    expect(Object.keys(ROTULOS_PADRAO).sort()).toEqual(["apresentacaoTitulo", "comodatosSubtitulo", "comodatosTitulo", "condicoesSubtitulo", "condicoesTitulo", "tituloProposta", "vantagensTitulo"]);
    const r = rotulosConsolidada({ rotulos: { condicoesTitulo: "Condições da Parceria", vantagensTitulo: "" } });
    expect(r.condicoesTitulo).toBe("Condições da Parceria");
    expect(r.vantagensTitulo).toBe("Vantagens do Comodato");
    expect(r.apresentacaoTitulo).toBe("Apresentação");
  });
});
