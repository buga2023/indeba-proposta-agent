import { describe, it, expect, vi, afterEach } from "vitest";
import { carregarCsv } from "@/lib/financeiro/ingest";
import { apurar } from "@/lib/contabil/apurar";
import { processarContabil } from "@/lib/contabil/processar";
import { obrigacoes, dependencias, pendentes, aliquota } from "@/lib/kb";

// Diário balanceado: venda à vista 1000 e compra de mercadoria 600.
const DIARIO = `Lancamento;Conta;Natureza;Debito;Credito
1;1.1.1 Caixa;ativo;1.000,00;0
1;3.1 Receita;receita;0;1.000,00
2;5.1 Custo;custo;600,00;0
2;1.1.1 Caixa;ativo;0;600,00`;

afterEach(() => vi.unstubAllGlobals());

describe("apurar — invariantes do motor (§2): D=C e A=P+PL+Resultado", () => {
  it("partida dobrada bate, balancete e BP/DRE fecham por construção", () => {
    const r = apurar(carregarCsv(DIARIO));
    expect(r.partidaDobradaOk).toBe(true);
    expect(r.totalDebitos).toBe("1600.00");
    expect(r.totalCreditos).toBe("1600.00");
    expect(r.divergencias).toEqual([]);
    expect(r.bp).not.toBeNull();
    expect(r.bp!.fecha).toBe(true); // Ativo = Passivo + PL + Resultado
    expect(r.bp!.totalAtivo).toBe("400.00"); // Caixa 1000 − 600
    expect(r.bp!.resultado).toBe("400.00");
    expect(r.dre!.totalReceitas).toBe("1000.00");
    expect(r.dre!.totalCustos).toBe("600.00");
    expect(r.dre!.resultado).toBe("400.00");
  });

  it("teste-guardião: lançamento desbalanceado → motor SINALIZA, não conserta", () => {
    const r = apurar(carregarCsv(`Lancamento;Conta;Natureza;Debito;Credito\n1;Caixa;ativo;1.000,00;0\n1;Receita;receita;0;900,00`));
    expect(r.partidaDobradaOk).toBe(false);
    expect(r.divergencias.length).toBeGreaterThan(0);
    expect(r.divergencias.some((d) => /não balanceia|NÃO bate/.test(d.descricao))).toBe(true);
    expect(r.bp!.fecha).toBe(false); // o balanço NÃO fecha — reflete o erro, não o mascara
  });

  it("sem natureza (plano de contas) → balancete sai, mas BP/DRE não, com aviso", () => {
    const r = apurar(carregarCsv(`Conta;Debito;Credito\nCaixa;1.000,00;0\nReceita;0;1.000,00`));
    expect(r.partidaDobradaOk).toBe(true);
    expect(r.bp).toBeNull();
    expect(r.aviso).toMatch(/natureza/);
  });
});

describe("processarContabil — guardião: números do motor, IA só comenta", () => {
  it("a IA dá o texto; os totais vêm do motor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/tags")) return { ok: true } as Response;
        if (String(url).includes("/api/generate")) return { ok: true, json: async () => ({ response: "Empresa saudável." }) } as Response;
        throw new Error(`fetch inesperado: ${url}`);
      }),
    );
    const r = await processarContabil({ planilha: { nome: "diario", csv: DIARIO } });
    expect(r.bp!.totalAtivo).toBe("400.00"); // motor
    expect(r.resumo).toContain("saudável"); // IA
  });
});

describe("KB versionada — esqueleto + dependências + lacunas", () => {
  it("carrega obrigações de 2026 e a cadeia de dependência (estrutural)", () => {
    expect(obrigacoes("2026").length).toBeGreaterThanOrEqual(8);
    // DCTFWeb depende de eSocial + EFD-Reinf, que dependem da folha.
    expect(dependencias("2026", "dctfweb").sort()).toEqual(["efd_reinf", "esocial", "folha"]);
    // ECF depende da ECD.
    expect(dependencias("2026", "ecf")).toContain("ecd");
  });

  it("sinaliza as lacunas a preencher (não inventa prazo/alíquota)", () => {
    expect(pendentes("2026").length).toBeGreaterThan(0);
    expect(aliquota("2026", "real", "IRPJ")).toBeNull(); // esqueleto vazio → null, não chute
  });
});
