import { describe, it, expect, vi, afterEach } from "vitest";
import { gerarContrato } from "@/lib/contrato/gerar";
import { extrairAchados, analisarContrato } from "@/lib/contrato/analisar";
import type { PropostaScope } from "@/lib/contracts";

// PropostaScope mínimo válido. Itens: 2×130,00 + 1×50,50 = 310,50 (o número-guardião).
const PROPOSTA: PropostaScope = {
  id: "prop-123",
  criadoEm: "2026-06-24T00:00:00.000Z",
  status: "finalizada",
  tipo: "comercial",
  template: "indeba",
  cliente: { razaoSocial: "Hospital Aurora LTDA", cnpj: "12.345.678/0001-90", segmento: "Saúde" },
  textoApresentacao: { conteudo: "Apresentação...", procedencia: "IA-TEXTO" },
  itens: [
    {
      codigo: "A1",
      nome: "Detergente Industrial",
      descricaoUso: "uso",
      imagemPath: "x.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 2,
      procedenciaSelecao: "IA-SELEÇÃO",
      motivo: "m",
    },
    {
      codigo: "B2",
      nome: "Álcool 70",
      descricaoUso: "uso",
      imagemPath: "y.png",
      embalagens: [{ tamanho: 1, unidade: "L", preco: "50.50", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1,
      procedenciaSelecao: "MANUAL",
      motivo: "m",
    },
  ],
  condicoesComerciais: {
    validade: "30 dias",
    prazoEntrega: "10 dias úteis",
    pagamento: "30/60 dias",
    frete: "CIF",
  },
};

function mockOllama(opts: { tagsOk?: boolean; generate?: string }) {
  const { tagsOk = true, generate = "{}" } = opts;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/tags")) return { ok: tagsOk } as Response;
      if (String(url).includes("/api/generate"))
        return { ok: true, json: async () => ({ response: generate }) } as Response;
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("gerarContrato — esqueleto determinístico do PropostaScope (§4)", () => {
  it("teste-guardião: a IA escreve cláusula com valor ERRADO, mas valorTotal vem do escopo", async () => {
    // Cláusulas mentem ("R$ 999,00"); o motor já fixou o total real (310,50).
    mockOllama({
      generate: JSON.stringify({
        clausulas: [{ titulo: "Do Preço", texto: "O valor é R$ 999,00 (mentira da IA)." }],
      }),
    });
    const c = await gerarContrato(PROPOSTA);
    expect(c.valorTotal).toBe("310.50"); // Σ determinístico, não o que a IA disse
    expect(c.itens[0].subtotal).toBe("260.00"); // 2 × 130,00
    expect(c.itens[1].subtotal).toBe("50.50");
    expect(c.contratante.razaoSocial).toBe("Hospital Aurora LTDA");
    expect(c.contratante.cnpj).toBe("12.345.678/0001-90");
    expect(c.contratada.razaoSocial).toBe("Indeba");
    expect(c.contratada.cnpj).toBe("[preencher]"); // não inventa CNPJ de origem
    expect(c.condicoes).toEqual(PROPOSTA.condicoesComerciais); // cópia, não geração
    expect(c.origemPropostaId).toBe("prop-123");
    expect(c.clausulas[0].procedencia).toBe("IA-TEXTO");
  });

  it("degradação (§5): sem Ollama, cláusulas viram MODELO-FIXO e o valor segue correto", async () => {
    mockOllama({ tagsOk: false });
    const c = await gerarContrato(PROPOSTA);
    expect(c.valorTotal).toBe("310.50");
    expect(c.clausulas.length).toBeGreaterThan(0);
    expect(c.clausulas.every((cl) => cl.procedencia === "MODELO-FIXO")).toBe(true);
    expect(c.clausulas.some((cl) => cl.texto.includes("R$ 310.50"))).toBe(true);
  });
});

const CONTRATO_TXT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS
Cláusula 5 - Em caso de atraso, será aplicada multa de 20% sobre o valor devido.
Cláusula 7 - O CONTRATANTE poderá promover a rescisão unilateral a qualquer tempo.
Cláusula 8 - Os valores serão objeto de reajuste anual pelo índice IGP-M.
Cláusula 9 - O valor total é de R$ 5.000,00.
Cláusula 12 - Fica eleito o foro da comarca de São Paulo.`;

describe("analisarContrato — achados vêm do MOTOR (regex), IA só explica (§2)", () => {
  it("extrai multa/rescisão/reajuste/foro/valor com trecho literal e severidade", () => {
    const achados = extrairAchados(CONTRATO_TXT);
    const por = (t: string) => achados.find((a) => a.tipo === t);

    expect(por("multa")?.valor).toBe("20%");
    expect(por("multa")?.severidade).toBe("alta"); // ≥10%
    expect(por("rescisao")?.severidade).toBe("alta");
    expect(por("reajuste")?.valor).toBe("IGP-M");
    expect(por("foro")?.valor).toMatch(/São Paulo/);
    expect(por("valor")?.valor).toBe("R$ 5.000,00");
    // trecho é LITERAL do contrato, nunca da IA
    expect(por("multa")?.trecho).toContain("multa de 20%");
  });

  it("ordena por severidade (altas primeiro)", () => {
    const achados = extrairAchados(CONTRATO_TXT);
    expect(achados[0].severidade).toBe("alta");
  });

  it("sem Ollama: achados preservados + explicação determinística", async () => {
    mockOllama({ tagsOk: false });
    const r = await analisarContrato(CONTRATO_TXT);
    expect(r.achados.length).toBeGreaterThanOrEqual(5);
    expect(r.explicacao).toContain("ponto(s) de atenção");
  });

  it("texto sem cláusulas de risco → sem achados, com aviso de revisar", async () => {
    mockOllama({ tagsOk: false });
    const r = await analisarContrato("Documento simples sem cláusulas relevantes.");
    expect(r.achados).toEqual([]);
    expect(r.explicacao).toMatch(/Revise manualmente/);
  });
});
