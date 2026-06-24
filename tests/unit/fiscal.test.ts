import { describe, it, expect, vi, afterEach } from "vitest";
import { parseNfe } from "@/lib/fiscal/parse";
import { processarFiscal } from "@/lib/fiscal/processar";

const NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
<NFe><infNFe Id="NFe35200114200166000187550010000000071000000017" versao="4.00">
<ide><nNF>7</nNF><serie>1</serie><dhEmi>2026-01-15T10:00:00-03:00</dhEmi><natOp>Venda</natOp></ide>
<emit><CNPJ>14200166000187</CNPJ><xNome>Indeba Quimica LTDA</xNome></emit>
<dest><CNPJ>12345678000190</CNPJ><xNome>Hospital Aurora</xNome></dest>
<det nItem="1"><prod><cProd>A1</cProd><xProd>Detergente</xProd><qCom>10</qCom><vUnCom>130.00</vUnCom><vProd>1300.00</vProd></prod></det>
<det nItem="2"><prod><cProd>B2</cProd><xProd>Alcool</xProd><qCom>5</qCom><vUnCom>50.00</vUnCom><vProd>250.00</vProd></prod></det>
<total><ICMSTot><vProd>1550.00</vProd><vFrete>0.00</vFrete><vICMS>279.00</vICMS><vNF>1550.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

afterEach(() => vi.unstubAllGlobals());

describe("parseNfe — extração determinística do XML (§2)", () => {
  it("extrai cabeçalho, partes, itens e totais", () => {
    const { nota, achados } = parseNfe(NFE);
    expect(nota.numero).toBe("7");
    expect(nota.chaveAcesso).toHaveLength(44);
    expect(nota.emitente.nome).toBe("Indeba Quimica LTDA");
    expect(nota.emitente.documento).toBe("14200166000187");
    expect(nota.destinatario.nome).toBe("Hospital Aurora");
    expect(nota.itens).toHaveLength(2);
    expect(nota.itens[0]).toMatchObject({ codigo: "A1", descricao: "Detergente", valorTotal: "1300.00" });
    expect(nota.valorTotal).toBe("1550.00");
    expect(achados).toEqual([]); // 1300 + 250 = 1550 (bate)
  });

  it("aponta divergência quando a soma dos itens ≠ total da nota", () => {
    const ruim = NFE.replace("<vProd>1550.00</vProd><vFrete>", "<vProd>9999.00</vProd><vFrete>");
    const { achados } = parseNfe(ruim);
    expect(achados.some((a) => a.tipo === "divergencia_total" && a.severidade === "alta")).toBe(true);
  });

  it("XML que não é NF-e → erro claro", () => {
    expect(() => parseNfe("<x>oi</x>")).toThrow(/NF-e/);
  });
});

function mockOllama(tagsOk: boolean, texto = "Resumo da IA.") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/tags")) return { ok: tagsOk } as Response;
      if (String(url).includes("/api/generate")) return { ok: true, json: async () => ({ response: texto }) } as Response;
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

describe("processarFiscal — guardião: valores vêm do XML, IA só resume", () => {
  it("a IA dá o resumo; os valores da nota são do parse", async () => {
    mockOllama(true, "Esta é uma nota de venda da Indeba.");
    const r = await processarFiscal({ xml: NFE });
    expect(r.nota.valorTotal).toBe("1550.00"); // do XML, não da IA
    expect(r.nota.itens).toHaveLength(2);
    expect(r.resumo).toContain("Indeba");
  });

  it("degradação (§5): sem Ollama, resumo determinístico dos dados", async () => {
    mockOllama(false);
    const r = await processarFiscal({ xml: NFE });
    expect(r.resumo).toContain("NF-e 7");
    expect(r.resumo).toContain("R$ 1550.00");
  });
});
