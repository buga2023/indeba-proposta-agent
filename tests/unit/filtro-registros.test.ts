import { describe, it, expect } from "vitest";
import { FILTRO_VAZIO, filtroAtivo, passaNoFiltro, contagem, alvoBusca } from "@/lib/filtro-registros";

// Filtro das listas das Ferramentas (áudio do Mateus com o João, 19/09/2026).
// O que estes testes protegem é a frase do João: "vários filtros que vão se juntando".
// Se alguém trocar o E por OU para "achar mais coisa", a busca por cliente+dia devolve a
// carteira inteira e a tela volta a ser a lista rolante que eles pediram para acabar.

describe("passaNoFiltro — os filtros se juntam (E, não OU)", () => {
  const visita = { cliente: "Frigorífico Boa Vista", data: "2026-09-16" };

  it("sem filtro nenhum, passa tudo", () => {
    expect(passaNoFiltro(FILTRO_VAZIO, visita.cliente, visita.data)).toBe(true);
  });

  it("cliente certo + período certo passa", () => {
    const f = { termo: "boa vista", de: "2026-09-01", ate: "2026-09-30" };
    expect(passaNoFiltro(f, visita.cliente, visita.data)).toBe(true);
  });

  it("cliente certo mas FORA do período não passa", () => {
    const f = { termo: "boa vista", de: "2026-10-01", ate: "2026-10-31" };
    expect(passaNoFiltro(f, visita.cliente, visita.data)).toBe(false);
  });

  it("período certo mas OUTRO cliente não passa", () => {
    const f = { termo: "laticínio", de: "2026-09-01", ate: "2026-09-30" };
    expect(passaNoFiltro(f, visita.cliente, visita.data)).toBe(false);
  });
});

describe("passaNoFiltro — busca por cliente", () => {
  it("casa por trecho, não só pelo nome inteiro", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "frigor" }, "Frigorífico Boa Vista")).toBe(true);
  });

  it("ignora maiúscula/minúscula", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "BOA VISTA" }, "Frigorífico Boa Vista")).toBe(true);
  });

  it("ignora espaço sobrando digitado sem querer", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "  boa vista  " }, "Frigorífico Boa Vista")).toBe(true);
  });

  it("cliente que não existe não passa", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "padaria" }, "Frigorífico Boa Vista")).toBe(false);
  });
});

describe("passaNoFiltro — período", () => {
  // João: "se lembrasse o dia exato e o mês exato, buscar lá, vai bater certinho".
  it("de e até no MESMO dia acha a visita daquele dia", () => {
    const f = { termo: "", de: "2026-09-16", ate: "2026-09-16" };
    expect(passaNoFiltro(f, "Boa Vista", "2026-09-16")).toBe(true);
    expect(passaNoFiltro(f, "Boa Vista", "2026-09-15")).toBe(false);
    expect(passaNoFiltro(f, "Boa Vista", "2026-09-17")).toBe(false);
  });

  it("as duas pontas entram (limite inclusivo)", () => {
    const f = { termo: "", de: "2026-09-01", ate: "2026-09-30" };
    expect(passaNoFiltro(f, "x", "2026-09-01")).toBe(true);
    expect(passaNoFiltro(f, "x", "2026-09-30")).toBe(true);
  });

  it("só 'de' vira 'desta data em diante'", () => {
    const f = { termo: "", de: "2026-09-10", ate: "" };
    expect(passaNoFiltro(f, "x", "2026-12-31")).toBe(true);
    expect(passaNoFiltro(f, "x", "2026-09-09")).toBe(false);
  });

  it("só 'até' vira 'até esta data'", () => {
    const f = { termo: "", de: "", ate: "2026-09-10" };
    expect(passaNoFiltro(f, "x", "2026-01-01")).toBe(true);
    expect(passaNoFiltro(f, "x", "2026-09-11")).toBe(false);
  });

  // Vira o ano: comparar string ISO só funciona porque o ano vem primeiro. Se alguém
  // trocar por dd/mm/aaaa em algum canto, este teste cai.
  it("compara ano antes de mês e dia", () => {
    const f = { termo: "", de: "2026-01-01", ate: "2026-12-31" };
    expect(passaNoFiltro(f, "x", "2025-12-31")).toBe(false);
    expect(passaNoFiltro(f, "x", "2027-01-01")).toBe(false);
  });

  // Contrato não tem data (Mateus: "aqui não precisa de período, no caso"). A tela de
  // Contratos nem mostra o campo, mas a regra precisa ser honesta se alguém mostrar.
  it("registro sem data sai quando há recorte de período", () => {
    expect(passaNoFiltro({ termo: "", de: "2026-09-01", ate: "" }, "Cliente X")).toBe(false);
    expect(passaNoFiltro({ termo: "", de: "", ate: "2026-09-01" }, "Cliente X")).toBe(false);
  });

  it("registro sem data passa normal quando o filtro é só de texto", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "cliente" }, "Cliente X")).toBe(true);
  });
});

describe("filtroAtivo e contagem", () => {
  it("filtro vazio não conta como ativo", () => {
    expect(filtroAtivo(FILTRO_VAZIO)).toBe(false);
    expect(filtroAtivo({ termo: "   ", de: "", ate: "" })).toBe(false);
  });

  it("qualquer campo preenchido ativa", () => {
    expect(filtroAtivo({ ...FILTRO_VAZIO, termo: "a" })).toBe(true);
    expect(filtroAtivo({ ...FILTRO_VAZIO, de: "2026-09-01" })).toBe(true);
    expect(filtroAtivo({ ...FILTRO_VAZIO, ate: "2026-09-01" })).toBe(true);
  });

  it("sem filtro o cabeçalho mostra só o total, como antes", () => {
    expect(contagem(12, 12, FILTRO_VAZIO)).toBe("12");
  });

  it("com filtro mostra o recorte sobre o total", () => {
    expect(contagem(3, 12, { ...FILTRO_VAZIO, termo: "boa vista" })).toBe("3 de 12");
  });
});

// Busca de contrato por "cliente ou CNPJ" (áudio do Mateus com o João, 19/09/2026).
// O ponto todo: o cadastro guarda o CNPJ como o vendedor digitou e quem procura digita
// de outro jeito. Se a comparação voltar a ser só de texto cru, este bloco cai.
describe("passaNoFiltro — CNPJ com ou sem pontuação", () => {
  const alvo = alvoBusca("Frigorífico Boa Vista", "12.345.678/0001-90");

  it("acha digitando o CNPJ sem pontuação", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "12345678000190" }, alvo)).toBe(true);
  });

  it("acha digitando com a pontuação", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "12.345.678/0001-90" }, alvo)).toBe(true);
  });

  it("acha por um pedaço do número", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "3456780" }, alvo)).toBe(true);
  });

  // O inverso: cadastrado sem pontuação, procurado com.
  it("funciona com o cadastro sem pontuação e a busca com", () => {
    const cru = alvoBusca("Laticínio Serra", "98765432000155");
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "98.765.432/0001-55" }, cru)).toBe(true);
  });

  it("o mesmo campo continua achando pelo nome", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "boa vista" }, alvo)).toBe(true);
  });

  it("CNPJ de outro cliente não passa", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "99999999000199" }, alvo)).toBe(false);
  });

  // O piso de 3 dígitos guarda só o caminho NORMALIZADO (o que atravessa a pontuação).
  // A busca literal por trecho continua valendo para qualquer tamanho — é a mesma que
  // sempre serviu ao nome do cliente, e mexer nela mudaria a busca por nome junto.
  // "80" não existe no texto cru ("…678/0001-90" não tem "8" seguido de "0"), e só
  // apareceria depois de tirar a pontuação — por isso é bloqueado.
  it("dois dígitos não atravessam a pontuação", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "80" }, alvoBusca("Padaria Sol", "12.345.678/0001-90"))).toBe(false);
  });

  it("a partir de três dígitos, atravessa", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "800" }, alvoBusca("Padaria Sol", "12.345.678/0001-90"))).toBe(true);
  });
});

describe("alvoBusca", () => {
  it("junta os campos preenchidos", () => {
    expect(alvoBusca("Cliente X", "123")).toBe("Cliente X 123");
  });

  // Contrato antigo não tem CNPJ — não pode virar "Cliente X null" nem "Cliente X ".
  it("ignora campo vazio ou ausente", () => {
    expect(alvoBusca("Cliente X", null)).toBe("Cliente X");
    expect(alvoBusca("Cliente X", undefined)).toBe("Cliente X");
    expect(alvoBusca("Cliente X", "")).toBe("Cliente X");
  });

  it("contrato sem CNPJ ainda é achado pelo nome", () => {
    expect(passaNoFiltro({ ...FILTRO_VAZIO, termo: "cliente" }, alvoBusca("Cliente X", null))).toBe(true);
  });
});
