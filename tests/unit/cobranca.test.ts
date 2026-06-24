import { describe, it, expect, vi, afterEach } from "vitest";
import { carregarCsv } from "@/lib/financeiro/ingest";
import { analisarInadimplencia, parseData } from "@/lib/cobranca/analisar";
import { processarCobranca } from "@/lib/cobranca/processar";

const HOJE = "2026-06-24";
const CSV = `Cliente;Valor;Vencimento;Status
Hospital A;1.000,00;2026-01-10;em aberto
Hospital A;500,00;2026-02-15;em aberto
Hotel B;2.000,00;2026-05-01;pago
Hotel B;800,00;2026-03-01;em aberto
Padaria C;300,00;2026-07-01;em aberto`;

afterEach(() => vi.unstubAllGlobals());

describe("parseData — datas BR/ISO", () => {
  it("aceita ISO e DD/MM/AAAA", () => {
    expect(parseData("2026-01-10")).toBe("2026-01-10");
    expect(parseData("15/01/2026")).toBe("2026-01-15");
    expect(parseData("1/2/26")).toBe("2026-02-01");
    expect(parseData("texto")).toBeNull();
  });
});

describe("analisarInadimplencia — só vencido E em aberto (motor determinístico §2)", () => {
  it("agrupa por cliente, soma, calcula atraso e severidade", () => {
    const r = analisarInadimplencia(carregarCsv(CSV), HOJE);
    expect(r.inadimplentes).toHaveLength(2); // Padaria C não venceu; Hotel B 2000 está pago
    const a = r.inadimplentes[0];
    expect(a.cliente).toBe("Hospital A");
    expect(a.valorDevido).toBe("1500.00"); // 1000 + 500
    expect(a.titulos).toBe(2);
    expect(a.vencimentoMaisAntigo).toBe("2026-01-10");
    expect(a.diasAtraso).toBe(165);
    expect(a.severidade).toBe("grave");
    expect(r.inadimplentes[1].cliente).toBe("Hotel B");
    expect(r.inadimplentes[1].valorDevido).toBe("800.00"); // só o título em aberto
    expect(r.totalDevido).toBe("2300.00");
  });

  it("sem coluna de vencimento → sinaliza a lacuna (Dados Primeiro), não inventa", () => {
    const r = analisarInadimplencia(carregarCsv("Cliente;Valor\nX;100,00"), HOJE);
    expect(r.inadimplentes).toEqual([]);
    expect(r.aviso).toMatch(/VENCIMENTO/);
  });
});

function mockOllama(opts: { tagsOk?: boolean; template?: string }) {
  const { tagsOk = true, template = "{cliente}, consta {valor} em aberto ({dias} dias)." } = opts;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/tags")) return { ok: tagsOk } as Response;
      if (String(url).includes("/api/generate"))
        return { ok: true, json: async () => ({ response: JSON.stringify({ leve: template, media: template, grave: template }) }) } as Response;
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

describe("processarCobranca — teste-guardião: valor da mensagem vem do MOTOR", () => {
  it("a IA dá só o template; o valor R$ 1.500,00 é preenchido pelo motor", async () => {
    mockOllama({ template: "{cliente}, você deve {valor} há {dias} dias." });
    const r = await processarCobranca({ planilha: { nome: "rec", csv: CSV }, hoje: HOJE }, "2026-06-24");
    const msg = r.inadimplentes[0].mensagem;
    expect(msg).toContain("Hospital A");
    expect(msg).toContain("R$ 1.500,00"); // do motor, não do modelo
    expect(msg).toContain("165 dias");
  });

  it("degradação (§5): sem Ollama, usa régua fixa e ainda preenche os valores", async () => {
    mockOllama({ tagsOk: false });
    const r = await processarCobranca({ planilha: { nome: "rec", csv: CSV }, hoje: HOJE }, "2026-06-24");
    expect(r.inadimplentes[0].mensagem).toContain("R$ 1.500,00");
  });
});
