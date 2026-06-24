import { describe, it, expect } from "vitest";
import { ChamadoCreate, ChamadoUpdate, Chamado, StatusChamado } from "@/lib/contracts";

// Chamados: o colaborador abre, o gestor resolve. Contrato é a fonte única de validação.
describe("contrato de chamado", () => {
  it("ChamadoCreate aceita um chamado válido e aplica defaults", () => {
    const r = ChamadoCreate.parse({ titulo: "PDF não gera", descricao: "Trava no Chrome ao exportar." });
    expect(r.categoria).toBe("outro"); // default
    expect(r.prioridade).toBe("media"); // default
  });

  it("ChamadoCreate rejeita título/descrição curtos demais", () => {
    expect(ChamadoCreate.safeParse({ titulo: "ab", descricao: "trava no chrome" }).success).toBe(false);
    expect(ChamadoCreate.safeParse({ titulo: "Título ok", descricao: "x" }).success).toBe(false);
  });

  it("ChamadoCreate rejeita categoria/prioridade fora do enum", () => {
    expect(ChamadoCreate.safeParse({ titulo: "Título", descricao: "descrição", categoria: "urgente" }).success).toBe(false);
    expect(ChamadoCreate.safeParse({ titulo: "Título", descricao: "descrição", prioridade: "critica" }).success).toBe(false);
  });

  it("ChamadoUpdate exige status OU resposta (nada para atualizar é rejeitado)", () => {
    expect(ChamadoUpdate.safeParse({}).success).toBe(false);
    expect(ChamadoUpdate.safeParse({ status: "resolvido" }).success).toBe(true);
    expect(ChamadoUpdate.safeParse({ respostaGestor: "Resolvido, era cache." }).success).toBe(true);
    expect(ChamadoUpdate.safeParse({ respostaGestor: null }).success).toBe(true); // limpar resposta
  });

  it("StatusChamado só aceita os três estados do fluxo", () => {
    expect(StatusChamado.options).toEqual(["aberto", "em_andamento", "resolvido"]);
    expect(StatusChamado.safeParse("fechado").success).toBe(false);
  });

  it("Chamado (transporte) valida um registro completo e rejeita status inválido", () => {
    const base = {
      id: "c1", titulo: "t", descricao: "d", categoria: "bug", prioridade: "alta",
      status: "aberto", autor: "mateus", respostaGestor: null,
      criadoEm: "2026-06-24T00:00:00.000Z", atualizadoEm: "2026-06-24T00:00:00.000Z",
    };
    expect(Chamado.safeParse(base).success).toBe(true);
    expect(Chamado.safeParse({ ...base, status: "pendente" }).success).toBe(false);
  });
});
