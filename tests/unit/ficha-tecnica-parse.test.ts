import { describe, it, expect } from "vitest";
import { camposDaFicha } from "@/lib/ficha-tecnica-parse";

// O botão "Preencher campos a partir da ficha" (pedido do Matheus, 06/08/2026: "pegar a ficha
// técnica e botar o título, o subtítulo, os benefícios, tudo na ordem, para o cara só copiar e
// colar"). A extração é determinística — texto real do PDF, recortado por cabeçalho —, e é
// isto que estes testes protegem: o que sai daqui vai para um campo que o gestor salva, então
// inventar conteúdo seria pior do que não preencher.
//
// O texto abaixo é o do ALVACLOR 180, extraído de public/fichas-tecnicas: uma linha só, com
// pontilhados de preenchimento, exatamente como o pdfjs devolve.
const ALVACLOR = `ALVEJANTE CLORADO, TAMBÉM INDICADO PARA OXIDAÇÃO DE MANCHAS EM TECIDOS.  MODO DE USO:  INFORMAÇÕES TÉCNICAS  ESPECIFICAÇÕES FÍSICO-QUÍMICAS: Aspecto........................................................Pó Cor...............................................................Branca Odor.............................................................Característico pH (sol. aq. 1%)...........................................8,0 + 1,0 Densidade(g/c   )........................................1,200 + 0,050 m³ COMPOSIÇÃO: Ácido Tricloroisocianúrico, Alcalinizantes, Sequestrante Carga. APLICAÇÃO - USO PROFISSIONAL: Na operação de oxidação das manchas na lavagem de roupas de algodão e poliéster, brancas e de cores firmes com sujidades leves e pesadas, em máquinas lavadoras.  EMBALAGEM: O ALVACLOR 180 ALVEJANTE é apresentado em baldes plásticos lacrados contendo 20 kg. CUIDADOS DE CONSERVAÇÃO: Manter o produto na embalagem original, fechada, em lugar seco, arejado e à sombra. PRECAUÇÕES DE USO: CONSERVE FORA DO ALCANCE DAS CRIANÇAS. PRAZO DE VALIDADE: 24 MESES a partir da data de fabricação. - Concentrado em cloro ativo; - Promove alvejamento e remoção de manchas sensíveis a oxidação; - Liberação gradual e controlada de cloro ativo; - Alto poder de remoção de manchas.`;

describe("camposDaFicha — recorte por cabeçalho", () => {
  const c = camposDaFicha(ALVACLOR);

  it("composição sai como está escrita na ficha", () => {
    expect(c.composicao).toBe("Ácido Tricloroisocianúrico, Alcalinizantes, Sequestrante Carga.");
  });

  it("aplicação para no próximo cabeçalho — não engole o bloco de embalagem", () => {
    expect(c.aplicacao).toMatch(/^Na operação de oxidação/);
    expect(c.aplicacao).not.toMatch(/EMBALAGEM|baldes/i);
  });

  it("a abertura vira a descrição", () => {
    expect(c.descricao).toBe("ALVEJANTE CLORADO, TAMBÉM INDICADO PARA OXIDAÇÃO DE MANCHAS EM TECIDOS.");
  });

  // Os pontilhados são preenchimento de formulário, não conteúdo; e o valor de um rótulo
  // termina onde o próximo começa (no PDF, a tabela inteira vira uma linha só).
  it("características saem sem os pontilhados e sem invadir o rótulo seguinte", () => {
    expect(c.caracteristicas?.aspecto).toBe("Pó");
    expect(c.caracteristicas?.cor).toBe("Branca");
    expect(c.caracteristicas?.odor).toBe("Característico");
    expect(c.caracteristicas?.pH).toBe("8,0 + 1,0");
  });

  it("benefícios viram lista, um por tópico", () => {
    expect(c.beneficios).toEqual([
      "Concentrado em cloro ativo",
      "Promove alvejamento e remoção de manchas sensíveis a oxidação",
      "Liberação gradual e controlada de cloro ativo",
      "Alto poder de remoção de manchas.",
    ]);
  });

  // "Cuidados de conservação" e "precauções de uso" fecham seção mas não viram campo: o
  // Matheus dispensou os dois ("essas aqui não precisa não"), e são conteúdo de rótulo.
  it("GUARDIÃO: precauções e cuidados não entram em campo nenhum", () => {
    const tudo = JSON.stringify(c);
    expect(tudo).not.toMatch(/CONSERVE FORA DO ALCANCE/i);
    expect(tudo).not.toMatch(/lugar seco, arejado/i);
  });
});

describe("camposDaFicha — o que não dá para ler", () => {
  it("texto vazio devolve objeto vazio, não campos inventados", () => {
    expect(camposDaFicha("")).toEqual({});
  });

  // PDF escaneado sai como texto solto sem nenhum cabeçalho. Melhor devolver pouco (e a rota
  // avisar) do que arriscar chutar o que é composição.
  it("texto sem cabeçalho não vira composição nem aplicação", () => {
    const c = camposDaFicha("Documento sem estrutura nenhuma, só uma frase perdida sobre limpeza.");
    expect(c.composicao).toBeUndefined();
    expect(c.aplicacao).toBeUndefined();
  });

  // Ficha que abre pela lista de vantagens (Candall PT): os tópicos são benefício, não a
  // frase de descrição — juntá-los enchia a descrição de hífens.
  it("ficha que abre com tópicos não transforma a lista em descrição", () => {
    const c = camposDaFicha(
      "- Eficaz na remoção de manchas sensíveis à redução; - Recuperação do grau de brancura em tecidos acinzentados; COMPOSIÇÃO: Agente redutor e estabilizante",
    );
    expect(c.descricao).toBeUndefined();
    expect(c.beneficios).toHaveLength(2);
    expect(c.composicao).toBe("Agente redutor e estabilizante");
  });
});
