import { describe, it, expect } from "vitest";
import { parseNfe, nfesParaTabela } from "@/lib/financeiro/nfe";
import { totalizar } from "@/lib/financeiro/engine";

// NF-e modelo 55 mínima, 2 itens, sob invólucro nfeProc.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260...">
      <ide><nNF>10250</nNF><serie>1</serie><dhEmi>2026-03-24T09:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>Indeba Distribuidora LTDA</xNome></emit>
      <dest><CNPJ>98765432000111</CNPJ><xNome>Restaurante Sabor da Bahia</xNome></dest>
      <det nItem="1">
        <prod><cProd>A1</cProd><xProd>Detergente neutro 5L</xProd><NCM>34022000</NCM>
          <qCom>38.0000</qCom><vUnCom>18.9000</vUnCom><vProd>718.20</vProd></prod>
      </det>
      <det nItem="2">
        <prod><cProd>B2</cProd><xProd>Esponja pacote</xProd><NCM>39241000</NCM>
          <qCom>14.0000</qCom><vUnCom>7.8000</vUnCom><vProd>109.20</vProd></prod>
      </det>
      <total><ICMSTot><vProd>827.40</vProd><vNF>827.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe("parser de NF-e (fonte fiscal primária, determinística)", () => {
  const nf = parseNfe(XML);

  it("extrai número, série, data e partes", () => {
    expect(nf.numero).toBe("10250");
    expect(nf.serie).toBe("1");
    expect(nf.dataEmissao).toBe("2026-03-24");
    expect(nf.emitente.nome).toBe("Indeba Distribuidora LTDA");
    expect(nf.destinatario.documento).toBe("98765432000111");
  });

  it("extrai os itens com NCM e valores (decimal string)", () => {
    expect(nf.itens).toHaveLength(2);
    expect(nf.itens[0]).toMatchObject({ codigo: "A1", ncm: "34022000", valorTotal: "718.20" });
    expect(nf.itens[1].descricao).toBe("Esponja pacote");
  });

  it("valorTotal = vNF (autoritativo do XML)", () => {
    expect(nf.valorTotal).toBe("827.40");
  });

  it("nfesParaTabela → motor soma o faturamento real", () => {
    const t = nfesParaTabela([nf, nf]); // duas notas iguais
    const r = totalizar(t, { metrica: "soma" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor as number).toBeCloseTo(1654.8, 2); // 827,40 × 2
  });

  it("XML que não é NF-e → erro claro", () => {
    expect(() => parseNfe("<html><body>oi</body></html>")).toThrow(/NF-e/);
  });
});
