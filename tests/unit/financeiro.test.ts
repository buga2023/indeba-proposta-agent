import { describe, it, expect, vi, afterEach } from "vitest";
import { carregarCsv, parseBrl } from "@/lib/financeiro/ingest";
import { totalizar, consolidar, baterResultados, fmt } from "@/lib/financeiro/engine";
import { calcularImposto } from "@/lib/financeiro/tax-kb";
import { perguntar, IaIndisponivelError } from "@/lib/financeiro/agente";
import type { FinanceiroRequest } from "@/lib/contracts";

// CSVs de exemplo (iguais aos do pacote original), formato BR: ; e decimal vírgula.
const VENDAS = `Data;Produto;Categoria;Valor
2026-01-03;Detergente;Limpeza;1.250,00
2026-01-05;Desinfetante;Limpeza;890,50
2026-01-10;Álcool 70;Higiene;2.300,00
2026-01-12;Sabão em pó;Limpeza;1.100,00
2026-01-20;Papel toalha;Higiene;640,00`;

const NOTAS = `Produto;Valor Nota
Detergente;1.250,00
Desinfetante;900,00
Álcool 70;2.300,00
Sabão em pó;1.100,00
Luva descartável;480,00`;

// Total real das vendas = 1250 + 890,50 + 2300 + 1100 + 640 = 6180,50
const TOTAL_VENDAS = "6.180,50";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ingest — parse BR (parseBrl) e detecção de colunas", () => {
  it("converte formatos monetários brasileiros", () => {
    expect(parseBrl("1.250,00")).toBe(1250);
    expect(parseBrl("1234,56")).toBe(1234.56);
    expect(parseBrl("R$ 2.300,00")).toBe(2300);
    expect(parseBrl("1.000")).toBe(1000); // milhar (heurística BR)
    expect(parseBrl("12.50")).toBe(12.5); // ponto decimal puro
    expect(parseBrl("1.234.567")).toBe(1234567); // milhar
    expect(parseBrl("(100,00)")).toBe(-100); // negativo entre parênteses
    expect(parseBrl("")).toBe(0);
  });

  it("carrega CSV ;, normaliza colunas e detecta numéricas (data não é número)", () => {
    const t = carregarCsv(VENDAS);
    expect(t.colunas).toEqual(["data", "produto", "categoria", "valor"]);
    expect(t.numericas.has("valor")).toBe(true);
    expect(t.numericas.has("data")).toBe(false); // data não vira número
    expect(t.linhas).toHaveLength(5);
    expect(t.linhas[0].valor).toBe(1250);
  });
});

describe("engine — motor determinístico", () => {
  it("totaliza soma da coluna de valor", () => {
    const r = totalizar(carregarCsv(VENDAS), { metrica: "soma" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor).toBe(6180.5);
      expect(r.resumoNumerico).toContain(TOTAL_VENDAS);
    }
  });

  it("totaliza agrupado por categoria (Limpeza > Higiene)", () => {
    const r = totalizar(carregarCsv(VENDAS), { agruparPor: "categoria", metrica: "soma" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const tabela = r.tabela as Array<{ grupo: string; valor: number }>;
      expect(tabela[0]).toEqual({ grupo: "Limpeza", valor: 3240.5 });
      expect(tabela[1]).toEqual({ grupo: "Higiene", valor: 2940 });
      expect(r.resumoNumerico).toContain("Total geral: R$ 6.180,50");
    }
  });

  it("filtra por categoria antes de somar", () => {
    const r = totalizar(carregarCsv(VENDAS), { metrica: "soma", filtros: { categoria: "higiene" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe(2940); // 2300 + 640
  });

  it("consolida duas planilhas marcando a fonte", () => {
    const r = consolidar({ vendas: carregarCsv(VENDAS), notas: carregarCsv(NOTAS) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.linhas).toBe(10);
      expect(r.tabela?.colunas).toContain("_fonte");
    }
  });

  it("concilia vendas × notas por produto e aponta divergências", () => {
    const r = baterResultados(carregarCsv(VENDAS), carregarCsv(NOTAS), {
      chave: "produto",
      nomeA: "vendas",
      nomeB: "notas",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.iguais).toBe(3); // Detergente, Álcool 70, Sabão em pó
      const div = r.divergentes as Array<{ chave: string; diferenca: number }>;
      expect(div).toHaveLength(1);
      expect(div[0].chave).toBe("Desinfetante");
      expect(div[0].diferenca).toBe(-9.5); // 890,50 − 900,00
      expect((r.so_a as unknown[]).length).toBe(1); // Papel toalha só nas vendas
      expect((r.so_b as unknown[]).length).toBe(1); // Luva descartável só nas notas
    }
  });
});

describe("tax-kb — alíquota só vem da base, nunca da IA (§2)", () => {
  it("calcula ICMS presumido (18%) sobre 10.000", () => {
    const r = calcularImposto(10000, "presumido", "ICMS");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor).toBe(1800);
      expect(r.resumoNumerico).toContain("R$ 1.800,00");
    }
  });

  it("imposto não cadastrado → erro (não inventa alíquota)", () => {
    const r = calcularImposto(10000, "simples", "ICMS"); // simples só tem DAS
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/não está cadastrada/);
  });
});

// Mocka o Ollama: /api/tags (disponível) e /api/generate (roteamento + verbalização).
// Decide pela presença de marcadores no prompt qual resposta devolver.
function mockOllama(rotaJson: object, textoVerbalizado: string, tagsOk = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/tags")) return { ok: tagsOk } as Response;
      if (String(url).includes("/api/generate")) {
        const prompt = JSON.parse(String(init?.body)).prompt as string;
        const response = prompt.includes("ROTEADOR") ? JSON.stringify(rotaJson) : textoVerbalizado;
        return { ok: true, json: async () => ({ response }) } as Response;
      }
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

describe("agente — teste-guardião: número que sai é do MOTOR, com a IA no fluxo", () => {
  const REQ: FinanceiroRequest = {
    pergunta: "quanto vendi no total?",
    planilhas: [{ nome: "vendas", csv: VENDAS }],
    planilhaAtual: null,
  };

  it("a IA verbaliza um valor ERRADO, mas o resumoNumerico carrega a verdade do motor", async () => {
    // O roteador manda consultar_dado/soma; a verbalização MENTE ("R$ 999,00").
    mockOllama({ intencao: "consultar_dado", metrica: "soma" }, "Você vendeu R$ 999,00 no total.");

    const res = await perguntar(REQ);
    // A verdade auditável (procedência MOTOR) é o total real do catálogo de vendas...
    expect(res.resumoNumerico).toContain(TOTAL_VENDAS);
    // ...e nunca o número alucinado pela IA.
    expect(res.resumoNumerico).not.toContain("999");
    expect(res.tipo).toBe("totalizar");
  });

  it("sem Ollama → IaIndisponivelError (não há rota determinística da intenção)", async () => {
    mockOllama({ intencao: "conversa" }, "", false);
    await expect(perguntar(REQ)).rejects.toBeInstanceOf(IaIndisponivelError);
  });

  it("conciliação via agente: roteia bater_resultados e o motor aponta as divergências", async () => {
    mockOllama(
      { intencao: "bater_resultados", chave: "produto", fonte_a: "vendas", fonte_b: "notas" },
      "Resumo da conciliação.",
    );
    const res = await perguntar({
      pergunta: "bate as vendas com as notas",
      planilhas: [
        { nome: "vendas", csv: VENDAS },
        { nome: "notas", csv: NOTAS },
      ],
      planilhaAtual: null,
    });
    expect(res.tipo).toBe("bater_resultados");
    expect(res.resumoNumerico).toContain("3 batem, 1 divergem");
  });
});
