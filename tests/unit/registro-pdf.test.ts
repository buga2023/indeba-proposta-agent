import { describe, it, expect } from "vitest";
import { dataBr, dataHoraBr, nomeArquivo } from "@/lib/pdf/registro";
import { ipDoRequest } from "@/lib/acessos";

// Pedidos do Mateus, 10/09/2026: ficha do registro em PDF ("cadê o relatório da última
// visita?") e a trilha de acessos ("ver os últimos acessos").

describe("dataBr — data da ficha no formato de quem lê", () => {
  it("converte YYYY-MM-DD em DD/MM/AAAA", () => {
    expect(dataBr("2026-08-31")).toBe("31/08/2026");
  });

  // O motivo de a conversão ser TEXTUAL e não via Date: `new Date("2026-01-01")` é lido
  // como meia-noite UTC e, no fuso de Brasília (-03), voltaria para 31/12/2025 na
  // impressão. A virada de ano é onde esse bug aparece.
  it("não anda um dia para trás na virada do ano", () => {
    expect(dataBr("2026-01-01")).toBe("01/01/2026");
  });

  it("devolve o valor original quando não é uma data ISO", () => {
    expect(dataBr("")).toBe("");
    expect(dataBr("31/08/2026")).toBe("31/08/2026");
  });
});

describe("dataHoraBr — carimbo de registro", () => {
  it("imprime em horário de Brasília, não em UTC", () => {
    // 12:00 UTC = 09:00 em Brasília (-03).
    expect(dataHoraBr(new Date("2026-08-31T12:00:00Z"))).toContain("09:00");
    expect(dataHoraBr(new Date("2026-08-31T12:00:00Z"))).toContain("31/08/2026");
  });
});

describe("nomeArquivo — o PDF vai por WhatsApp, o nome tem que sobreviver", () => {
  it("sana acento, espaço e barra do nome do cliente", () => {
    expect(nomeArquivo("visita", "Lavanderia São João / Filial")).toBe("visita-Lavanderia_S_o_Jo_o___Filial.pdf");
  });

  it("cai num nome genérico quando não sobra nada", () => {
    expect(nomeArquivo("visita", "///")).toBe("visita-___.pdf");
    expect(nomeArquivo("visita", "")).toBe("visita-registro.pdf");
  });

  // Sem o corte, um "cliente" colado de uma planilha viraria um nome de arquivo que o
  // sistema de arquivos recusa.
  it("limita o tamanho", () => {
    expect(nomeArquivo("visita", "A".repeat(200))).toBe(`visita-${"A".repeat(60)}.pdf`);
  });
});

describe("ipDoRequest — origem do acesso atrás do proxy", () => {
  const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n] ?? null } });

  it("pega o primeiro IP do x-forwarded-for (o cliente, não os proxies)", () => {
    expect(ipDoRequest(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7");
  });

  it("cai no x-real-ip quando não há x-forwarded-for", () => {
    expect(ipDoRequest(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  // Dev local não manda nenhum dos dois: o acesso ainda é registrado, só sem IP.
  it("devolve null quando nenhum cabeçalho veio", () => {
    expect(ipDoRequest(req({}))).toBeNull();
    expect(ipDoRequest(req({ "x-forwarded-for": "" }))).toBeNull();
  });
});
