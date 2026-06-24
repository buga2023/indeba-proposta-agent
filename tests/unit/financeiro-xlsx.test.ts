import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { carregarCsv } from "@/lib/financeiro/ingest";
import { totalizar } from "@/lib/financeiro/engine";

// A UI converte XLSX→CSV no navegador (SheetJS) e envia o CSV; o motor não muda.
// Este teste prova o caminho de dados: xlsx → sheet_to_csv → carregarCsv → totalizar.
describe("financeiro — XLSX aceito como planilha (convertido p/ CSV)", () => {
  it("1ª aba do xlsx vira CSV e o motor soma os valores corretamente", () => {
    const aoa = [
      ["Produto", "Valor"],
      ["Detergente", 1250],
      ["Álcool 70", 2300.5],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const csv = XLSX.utils.sheet_to_csv(ws);

    const t = carregarCsv(csv);
    expect(t.colunas).toEqual(["produto", "valor"]);
    expect(t.numericas.has("valor")).toBe(true);

    const r = totalizar(t, { metrica: "soma" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe(3550.5);
  });
});
