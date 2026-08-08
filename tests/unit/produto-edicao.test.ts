import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Guardiões da EDIÇÃO e da EXCLUSÃO de produto pela tela (pedido do Mateus em 05/08/2026:
// "tem que deixar uma opção para eu, como administrador, adicionar, excluir ou editar").
//
// O que precisa ficar de pé aqui: quem pode escrever, o que a edição NÃO pode apagar sem
// pedido explícito (foto, ficha, estado de arquivado) e a fronteira com o catálogo-base —
// os 150 do JSON são versionados no git e não se editam por esta rota.
const { usuarioAtual, findUnique, update, create, remover, carregarCatalogo, listarProdutosCustom, listarExcluidos } = vi.hoisted(() => ({
  usuarioAtual: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  remover: vi.fn(),
  carregarCatalogo: vi.fn(),
  listarProdutosCustom: vi.fn(),
  listarExcluidos: vi.fn(),
}));

vi.mock("@/lib/auth-db", () => ({ usuarioAtual }));
vi.mock("@/lib/db", () => ({
  prisma: { produtoCustom: { create, findMany: vi.fn(), findUnique, update, delete: remover, upsert: vi.fn() } },
}));
vi.mock("@/lib/catalogo", () => ({ carregarCatalogo }));
vi.mock("@/lib/produto-custom", () => ({ listarProdutosCustom, listarExcluidos }));

import { PUT, DELETE, PATCH } from "@/app/api/produtos/route";

const GESTOR = { email: "gestor@indeba.com", papel: "admin" };
const VENDEDOR = { email: "vendedor@indeba.com", papel: "user" };

const EDICAO = {
  codigo: "TESTE-NOVO",
  nome: "Produto de Teste (renomeado)",
  marca: "indeba",
  linha: "limpeza_conservacao",
  descricaoCurta: "curta",
  descricaoUso: "uso",
  segmentos: [],
  funcoes: ["multiuso"],
  metodos: ["manual"],
  embalagens: [{ tamanho: 5, unidade: "L", preco: null, diluicaoMax: null, custoDiluido: null }],
};

// O que está gravado hoje: arquivado e com ficha técnica anexada.
const NO_BANCO = {
  dados: { ...EDICAO, nome: "Produto de Teste", ativo: false, imagemPath: "", fichaTecnicaPath: null },
  fichaMime: "application/pdf",
};

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "f.png", { type: "image/png" });
const pdf = () => new File([new Uint8Array([37, 80, 68, 70])], "f.pdf", { type: "application/pdf" });

function req(dados: unknown, extras: Record<string, File | string> = {}) {
  const form = new FormData();
  if (dados !== undefined) form.append("dados", JSON.stringify(dados));
  for (const [k, v] of Object.entries(extras)) form.append(k, v);
  return { formData: async () => form } as unknown as NextRequest;
}

const dadosSalvos = () => update.mock.calls[0][0].data.dados;
// Override de produto da base entra por `create`, não por `update` — a linha ainda não existe.
const dadosCriados = () => create.mock.calls[0][0].data.dados;

// O PRIMMAX-PLUS representa a base: mora no JSON e (salvo quando o teste disser o contrário)
// não tem linha no banco. Ativo e com ficha versionada, como os produtos reais do arquivo.
const NA_BASE = { codigo: "PRIMMAX-PLUS", ativo: true, fichaTecnicaPath: "/fichas-tecnicas/primmax-plus.pdf" };

beforeEach(() => {
  for (const m of [usuarioAtual, findUnique, update, create, remover, carregarCatalogo]) m.mockReset();
  carregarCatalogo.mockReturnValue({ marca: "indeba_express", produtos: [NA_BASE] });
  findUnique.mockResolvedValue(NO_BANCO);
  update.mockResolvedValue({});
  create.mockResolvedValue({});
  remover.mockResolvedValue({});
});

describe("PUT /api/produtos — só o gestor edita", () => {
  it("401 sem sessão", async () => {
    usuarioAtual.mockResolvedValue(null);
    expect((await PUT(req(EDICAO))).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("403 para vendedor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    expect((await PUT(req(EDICAO))).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/produtos — editar produto da base grava override", () => {
  beforeEach(() => {
    usuarioAtual.mockResolvedValue(GESTOR);
    findUnique.mockResolvedValue(null); // produto da base ainda não tem linha no banco
  });

  // Isto já foi 404 por design, e a recusa é que era o problema: os ~150 do JSON ficavam sem
  // conserto pela tela (o Mateus esbarrou nisso). Agora a primeira edição CRIA a linha, que
  // passa a vencer o JSON na leitura — sem tocar no arquivo versionado.
  it("primeira edição de produto da base cria a linha, não devolve 404", async () => {
    const r = await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS" }));
    expect(r.status).toBe(200);
    expect(create).toHaveBeenCalled();
    expect(dadosCriados().codigo).toBe("PRIMMAX-PLUS");
    expect(dadosCriados().nome).toBe("Produto de Teste (renomeado)");
  });

  it("o override nasce sem bytes de imagem — a foto continua sendo a versionada", async () => {
    await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS" }));
    expect(create.mock.calls[0][0].data).not.toHaveProperty("imagem");
    expect(dadosCriados().imagemPath).toBe("");
  });

  it("com foto anexada, o override nasce com a imagem própria", async () => {
    await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS" }, { imagem: png() }));
    expect(create.mock.calls[0][0].data.imagemMime).toBe("image/png");
  });

  // Sem linha no banco, o estado a preservar é o do JSON — não um `true` inventado.
  it("GUARDIÃO: `ativo` ausente herda o estado da base", async () => {
    carregarCatalogo.mockReturnValue({ marca: "indeba_express", produtos: [{ ...NA_BASE, ativo: false }] });
    await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS" }));
    expect(dadosCriados().ativo).toBe(false);
  });

  it("arquivar um produto da base é edição com `ativo: false`", async () => {
    await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS", ativo: false }));
    expect(dadosCriados().ativo).toBe(false);
  });

  // A ficha herdada está no repositório, não no banco: aceitar o pedido e não fazer nada
  // deixaria o gestor certo de que apagou.
  it("GUARDIÃO: remover a ficha herdada da base é recusado com explicação", async () => {
    const r = await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS" }, { removerFicha: "1" }));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toMatch(/base versionada/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("anexar ficha nova a um produto da base é permitido", async () => {
    const r = await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS" }, { ficha: pdf(), removerFicha: "1" }));
    expect(r.status).toBe(200);
    expect(create.mock.calls[0][0].data.fichaMime).toBe("application/pdf");
  });

  // Editar exige que o produto exista em ALGUMA fonte: código inventado continua 404, senão
  // o PUT viraria uma segunda porta de cadastro, sem foto obrigatória nem checagem de código.
  it("GUARDIÃO: código que não existe em fonte nenhuma é 404, não criação", async () => {
    const r = await PUT(req({ ...EDICAO, codigo: "NAO-EXISTE" }));
    expect(r.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/produtos — contrato e segurança", () => {
  // Com chaves: sem elas, o retorno é o próprio mock e o vitest o executa como teardown.
  beforeEach(() => {
    usuarioAtual.mockResolvedValue(GESTOR);
  });

  it("dados fora do contrato Zod são recusados (linha inexistente)", async () => {
    expect((await PUT(req({ ...EDICAO, linha: "espacial" }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("GUARDIÃO: imagemPath enviado pelo cliente é ignorado, não gravado", async () => {
    await PUT(req({ ...EDICAO, imagemPath: "https://malicioso.example/x.png" }));
    expect(dadosSalvos().imagemPath).toBe("");
    expect(JSON.stringify(dadosSalvos())).not.toContain("malicioso");
  });
});

describe("PUT /api/produtos — o que a edição não pode apagar sozinha", () => {
  // Com chaves: sem elas, o retorno é o próprio mock e o vitest o executa como teardown.
  beforeEach(() => {
    usuarioAtual.mockResolvedValue(GESTOR);
  });

  it("salva o texto novo", async () => {
    const r = await PUT(req(EDICAO));
    expect(r.status).toBe(200);
    expect(dadosSalvos().nome).toBe("Produto de Teste (renomeado)");
  });

  // Editar só a descrição não pode exigir reenviar a foto — e não enviar não pode zerá-la.
  it("GUARDIÃO: sem foto anexada, os bytes da imagem não são tocados", async () => {
    await PUT(req(EDICAO));
    expect(update.mock.calls[0][0].data).not.toHaveProperty("imagem");
    expect(update.mock.calls[0][0].data).not.toHaveProperty("imagemMime");
  });

  it("com foto anexada, troca a imagem", async () => {
    await PUT(req(EDICAO, { imagem: png() }));
    expect(update.mock.calls[0][0].data.imagemMime).toBe("image/png");
  });

  it("foto que não é imagem é recusada", async () => {
    const exe = new File([new Uint8Array([1])], "x.exe", { type: "application/x-msdownload" });
    expect((await PUT(req(EDICAO, { imagem: exe }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  // A ficha só some com pedido explícito: "não anexei nada" é o caso comum de quem editou
  // apenas o texto, e apagar a ficha aí seria perda silenciosa.
  it("GUARDIÃO: sem sinal de remoção, a ficha técnica atual permanece", async () => {
    await PUT(req(EDICAO));
    expect(update.mock.calls[0][0].data).not.toHaveProperty("ficha");
  });

  it("removerFicha=1 apaga a ficha e o mime junto", async () => {
    await PUT(req(EDICAO, { removerFicha: "1" }));
    expect(update.mock.calls[0][0].data.ficha).toBeNull();
    expect(update.mock.calls[0][0].data.fichaMime).toBeNull();
  });

  it("ficha nova tem prioridade sobre o pedido de remoção", async () => {
    await PUT(req(EDICAO, { ficha: pdf(), removerFicha: "1" }));
    expect(update.mock.calls[0][0].data.fichaMime).toBe("application/pdf");
  });

  it("ficha que não é PDF é recusada", async () => {
    const txt = new File([new Uint8Array([1])], "f.txt", { type: "text/plain" });
    expect((await PUT(req(EDICAO, { ficha: txt }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  // Quem arquivou o produto fez isso de propósito. Corrigir um typo não pode ressuscitá-lo
  // no catálogo — `ativo` só muda quando a edição diz qual é o novo valor.
  it("GUARDIÃO: `ativo` ausente preserva o estado gravado (arquivado continua arquivado)", async () => {
    await PUT(req(EDICAO));
    expect(dadosSalvos().ativo).toBe(false);
  });

  it("`ativo: true` reativa o produto arquivado", async () => {
    await PUT(req({ ...EDICAO, ativo: true }));
    expect(dadosSalvos().ativo).toBe(true);
  });
});

// A exclusão virou LÁPIDE em 06/08/2026. Antes, ela só valia para o produto nascido na tela
// (DELETE da linha) e o produto da base era recusado com 409 — o que deixava o Matheus sem
// como tirar do catálogo um dos ~150 ("criar também, para os produtos que já foram criados, a
// opção de excluir"). Agora a linha fica marcada e a leitura filtra o código nas duas fontes,
// o que faz o produto da base sumir de verdade E torna toda exclusão reversível.
describe("DELETE /api/produtos", () => {
  const reqDel = (codigo: string | null) =>
    ({ nextUrl: { searchParams: new URLSearchParams(codigo === null ? "" : `codigo=${codigo}`) } }) as unknown as NextRequest;

  it("401 sem sessão", async () => {
    usuarioAtual.mockResolvedValue(null);
    expect((await DELETE(reqDel("TESTE-NOVO"))).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("403 para vendedor — excluir produto é ato de gestor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    expect((await DELETE(reqDel("TESTE-NOVO"))).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  // GUARDIÃO: a linha NÃO é apagada. É dela que sai o nome no painel de restauração, e é ela
  // que segura os `dados` para o dia em que o gestor desfizer a exclusão.
  it("GUARDIÃO: excluir marca a lápide em vez de apagar a linha", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    findUnique.mockResolvedValue({ id: "linha1" });
    expect((await DELETE(reqDel("TESTE-NOVO"))).status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { codigo: "TESTE-NOVO" }, data: { excluido: true } });
    expect(remover).not.toHaveBeenCalled();
  });

  // Produto da base nunca editado não tem linha: a lápide precisa nascer, com uma cópia do
  // JSON dentro. Sem a cópia, o painel de restauração não teria nem o nome para exibir.
  it("produto da base sem linha ganha lápide criada, com cópia dos dados", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    findUnique.mockResolvedValue(null);
    expect((await DELETE(reqDel("PRIMMAX-PLUS"))).status).toBe(200);
    expect(create.mock.calls[0][0].data.excluido).toBe(true);
    expect(create.mock.calls[0][0].data.dados.codigo).toBe("PRIMMAX-PLUS");
  });

  // Código que não é da base e não está no banco: 404 — nunca um 500, que pareceria falha do
  // sistema, nem um 200, que faria o gestor achar que excluiu algo.
  it("produto inexistente devolve 404", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    findUnique.mockResolvedValue(null);
    const r = await DELETE(reqDel("NAO-EXISTE"));
    expect(r.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("sem código, 400", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    expect((await DELETE(reqDel(null))).status).toBe(400);
  });
});

describe("PATCH /api/produtos — restaurar", () => {
  const reqPatch = (corpo: unknown) => ({ json: async () => corpo }) as unknown as NextRequest;

  it("403 para vendedor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    expect((await PATCH(reqPatch({ codigo: "TESTE-NOVO" }))).status).toBe(403);
  });

  // Restaurar NUNCA faz hard-delete, nem para produto da base: a exclusão de um produto da
  // base já editado mantém o override em `dados`, e o DELETE antigo o perdia em silêncio
  // (editar preço, excluir, restaurar → voltava ao preço do JSON). Só desmarca a lápide.
  it("restaurar produto da base só desmarca a lápide (preserva override)", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    findUnique.mockResolvedValue({ excluido: true });
    expect((await PATCH(reqPatch({ codigo: "PRIMMAX-PLUS" }))).status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { codigo: "PRIMMAX-PLUS" }, data: { excluido: false } });
    expect(remover).not.toHaveBeenCalled();
  });

  // Produto que nasceu na tela só existe no banco: apagar a linha o perderia de vez.
  it("restaurar produto próprio só desmarca a lápide", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    findUnique.mockResolvedValue({ excluido: true });
    expect((await PATCH(reqPatch({ codigo: "TESTE-NOVO" }))).status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { codigo: "TESTE-NOVO" }, data: { excluido: false } });
    expect(remover).not.toHaveBeenCalled();
  });

  it("restaurar o que não está excluído é 404", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    findUnique.mockResolvedValue({ excluido: false });
    expect((await PATCH(reqPatch({ codigo: "TESTE-NOVO" }))).status).toBe(404);
  });
});
