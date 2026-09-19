import { describe, it, expect } from "vitest";
import { nomeArquivo, fichaHtml, LOGO_FICHA } from "@/lib/pdf/registro";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dataBr, dataHoraBr } from "@/lib/datas";
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

// Marca da ficha (Mateus, 19/09/2026): "ainda está saindo a logo da Indeba errada, a mesma
// do início, a da identidade visual Indeba". A ficha vai para o CLIENTE — sair com a marca
// da indústria em vez da Indeba Express é erro que chega na mão dele, não bug interno.
describe("LOGO_FICHA — a ficha assina Indeba Express", () => {
  it("usa a logo Express, não a institucional", () => {
    expect(LOGO_FICHA).toBe("/marca/indeba-express-logo.png");
  });

  // O arquivo errado tem nome parecido: indeba-logo.png vs indeba-express-logo.png.
  it("não é a institucional (indeba-logo.png)", () => {
    expect(LOGO_FICHA).not.toBe("/marca/indeba-logo.png");
  });

  it("o arquivo existe em public/", () => {
    expect(existsSync(join(process.cwd(), "public", LOGO_FICHA))).toBe(true);
  });
});

describe("fichaHtml — a logo entra no documento", () => {
  const ficha = {
    titulo: "Relatório de Visita de Rotina",
    cliente: "Frigorífico Boa Vista",
    campos: [],
    blocos: [],
    fotos: [],
    registradoPor: "João",
    registradoEm: "16/09/2026 às 14:30",
  };

  it("embute a logo recebida e a identifica como Indeba Express", () => {
    const html = fichaHtml(ficha, "data:image/png;base64,XYZ");
    expect(html).toContain('src="data:image/png;base64,XYZ"');
    expect(html).toContain('alt="Indeba Express"');
  });

  // Sem logo o cabeçalho cai no texto — que também não pode voltar a dizer só "INDEBA".
  it("o fallback de texto também assina Express", () => {
    const html = fichaHtml(ficha, "");
    expect(html).toContain("INDEBA EXPRESS");
  });
});
