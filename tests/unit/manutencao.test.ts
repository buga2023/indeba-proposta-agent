import { describe, it, expect } from "vitest";
import { inicioDoDiaBrasilia } from "@/lib/manutencao";

// A faxina roda na Vercel em UTC, mas o "hoje" que interessa é o de Brasília (UTC-3).
// Errar esse corte arquiva as propostas da própria tarde — é o risco real desta rotina.
describe("inicioDoDiaBrasilia", () => {
  it("às 17h de Brasília (20:00 UTC), o corte é a meia-noite do MESMO dia", () => {
    // 23/07/2026 17:00 BRT = 20:00 UTC
    const corte = inicioDoDiaBrasilia(new Date("2026-07-23T20:00:00Z"));
    // meia-noite de 23/07 em Brasília = 03:00 UTC do dia 23
    expect(corte.toISOString()).toBe("2026-07-23T03:00:00.000Z");
  });

  it("guardião: proposta criada hoje de manhã NÃO entra na faxina das 17h", () => {
    const agora = new Date("2026-07-23T20:00:00Z"); // 17h BRT
    const corte = inicioDoDiaBrasilia(agora);
    const criadaHojeCedo = new Date("2026-07-23T12:00:00Z"); // 09h BRT do mesmo dia
    expect(criadaHojeCedo.getTime() < corte.getTime()).toBe(false);
  });

  it("guardião: proposta de ontem entra na faxina", () => {
    const corte = inicioDoDiaBrasilia(new Date("2026-07-23T20:00:00Z"));
    const ontem = new Date("2026-07-22T21:00:00Z"); // 18h BRT do dia 22
    expect(ontem.getTime() < corte.getTime()).toBe(true);
  });

  it("proposta criada 23h59 BRT de ontem entra; 00h01 BRT de hoje não", () => {
    const corte = inicioDoDiaBrasilia(new Date("2026-07-23T20:00:00Z"));
    expect(new Date("2026-07-23T02:59:00Z").getTime() < corte.getTime()).toBe(true); // 23:59 BRT do dia 22
    expect(new Date("2026-07-23T03:01:00Z").getTime() < corte.getTime()).toBe(false); // 00:01 BRT do dia 23
  });

  it("madrugada UTC ainda é o dia anterior em Brasília", () => {
    // 01:00 UTC do dia 24 = 22:00 BRT do dia 23 → o dia corrente ainda é 23
    const corte = inicioDoDiaBrasilia(new Date("2026-07-24T01:00:00Z"));
    expect(corte.toISOString()).toBe("2026-07-23T03:00:00.000Z");
  });

  it("vira o mês corretamente", () => {
    const corte = inicioDoDiaBrasilia(new Date("2026-08-01T20:00:00Z"));
    expect(corte.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });
});
