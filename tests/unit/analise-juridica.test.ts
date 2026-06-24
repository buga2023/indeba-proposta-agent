import { describe, it, expect, vi, afterEach } from "vitest";
import { analisarJuridico } from "@/lib/contrato/analise-juridica";

const CONTRATO = `
CONTRATO DE FORNECIMENTO. CONTRATANTE e CONTRATADA (CNPJ) têm por objeto deste contrato
o fornecimento de produtos. Do pagamento: valor total via boleto, vencimento 30 dias.
Da vigência: prazo de 12 meses. Da multa: 10% por descumprimento. Foro: Salvador/BA.
`;

afterEach(() => vi.unstubAllGlobals());

describe("orquestrador de análise jurídica (cobertura por código, IA só explica)", () => {
  it("sem IA: cobertura determinística + lacunas ancoradas na norma", async () => {
    const a = await analisarJuridico(CONTRATO, { comIA: false });
    expect(a.cobertura.total).toBe(a.itens.length);
    expect(a.cobertura.presentes + a.cobertura.ausentes).toBe(a.cobertura.total);
    // LGPD ausente e ancorada na Lei 13.709
    const lgpd = a.lacunas.find((l) => l.id === "lgpd");
    expect(lgpd).toBeTruthy();
    expect(lgpd?.referencia?.lei).toBe("Lei 13.709/2018");
    expect(a.explicacao).toBeNull(); // não pediu IA
    expect(a.aviso).toMatch(/advogado/i);
  });

  it("com IA: explicação preenchida, mas a lista de lacunas continua vindo do código", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/tags")) return { ok: true } as Response;
        return { ok: true, json: async () => ({ response: JSON.stringify({ explicacao: "Vale revisar as lacunas." }) }) } as Response;
      }),
    );
    const a = await analisarJuridico(CONTRATO, { comIA: true });
    expect(a.explicacao).toMatch(/revisar/i);
    expect(a.lacunas.some((l) => l.id === "lgpd")).toBe(true); // do checklist, não da IA
  });
});
