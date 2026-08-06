import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth-db";
import { Produto } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { carregarCatalogo } from "@/lib/catalogo";
import { listarProdutosCustom } from "@/lib/produto-custom";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Cadastro de produto pela tela. Mesmo gate do painel de acessos: catálogo é dado crítico —
// é dele que sai a ficha, a foto e o produto que vai na proposta —, então quem escreve é o
// gestor. Ver docs/spec-cadastro-produto.md.
async function exigirGestor(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }), email: "" };
  if (u.papel !== "admin") {
    return { erro: NextResponse.json({ erro: "Só o gestor cadastra produto." }, { status: 403 }), email: "" };
  }
  return { erro: null, email: u.email };
}

export async function GET(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;
  try {
    return NextResponse.json({ produtos: await listarProdutosCustom() });
  } catch (e) {
    return respostaErro(e, "Falha ao listar produtos cadastrados", 500);
  }
}

const MB = 1024 * 1024;
const IMAGEM_MIMES = ["image/png", "image/jpeg", "image/webp"];

// Validação dos anexos, compartilhada por cadastro e edição: os dois aceitam os MESMOS
// arquivos, e regra de upload duplicada é regra que diverge (um lado aperta, o outro fica
// com o buraco). Devolve a resposta de erro pronta ou o arquivo, quando ele veio.
function lerImagem(form: FormData): { erro: NextResponse } | { erro: null; imagem: File | null } {
  const imagem = form.get("imagem");
  if (!(imagem instanceof File) || imagem.size === 0) return { erro: null, imagem: null };
  if (!IMAGEM_MIMES.includes(imagem.type)) {
    return { erro: NextResponse.json({ erro: "Foto deve ser PNG, JPG ou WebP." }, { status: 400 }) };
  }
  if (imagem.size > 5 * MB) {
    return { erro: NextResponse.json({ erro: "Foto acima de 5 MB." }, { status: 400 }) };
  }
  return { erro: null, imagem };
}

function lerFicha(form: FormData): { erro: NextResponse } | { erro: null; ficha: File | null } {
  const ficha = form.get("ficha");
  if (!(ficha instanceof File) || ficha.size === 0) return { erro: null, ficha: null };
  if (ficha.type !== "application/pdf") {
    return { erro: NextResponse.json({ erro: "A ficha técnica deve ser um PDF." }, { status: 400 }) };
  }
  if (ficha.size > 20 * MB) {
    return { erro: NextResponse.json({ erro: "Ficha técnica acima de 20 MB." }, { status: 400 }) };
  }
  return { erro: null, ficha };
}

// `imagemPath`/`fichaTecnicaPath` são DERIVADOS do código na leitura (produto-custom.ts), e
// `ativo` é decidido aqui — por isso o formulário não os envia. Aceitar `imagemPath` do
// cliente deixaria um cadastro apontar a foto do produto para qualquer URL.
const Entrada = Produto.omit({ imagemPath: true, fichaTecnicaPath: true, ativo: true });
// Na EDIÇÃO o gestor também decide se o produto continua ativo — arquivar é a saída
// intermediária entre manter e apagar: some dos filtros sem sumir das propostas antigas.
const EntradaEdicao = Entrada.extend({ ativo: z.boolean().optional() });

// O formulário manda o produto como JSON num campo do FormData (o resto são os bytes).
function dadosCrus(form: FormData): unknown {
  return JSON.parse(String(form.get("dados") ?? "null") || "null");
}

async function lerForm(req: NextRequest): Promise<FormData | null> {
  try {
    return await req.formData();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { erro, email } = await exigirGestor(req);
  if (erro) return erro;

  const form = await lerForm(req);
  if (!form) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });

  const parsed = Entrada.safeParse(dadosCrus(form));
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados do produto inválidos.", detalhe: parsed.error.flatten() }, { status: 400 });
  }
  const codigo = parsed.data.codigo.trim().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(codigo)) {
    return NextResponse.json({ erro: "Código só aceita letras, números e hífen." }, { status: 400 });
  }

  // Colisão com o JSON precisa ser barrada aqui: o `@unique` da tabela só enxerga o banco, e
  // dois produtos com o mesmo código fariam proposta e matcher disputarem qual é qual.
  if (carregarCatalogo().produtos.some((p) => p.codigo === codigo)) {
    return NextResponse.json({ erro: `O código ${codigo} já existe no catálogo.` }, { status: 409 });
  }

  const img = lerImagem(form);
  if (img.erro) return img.erro;
  // Só no cadastro a foto é obrigatória: na edição, não enviar significa "mantém a atual".
  if (!img.imagem) return NextResponse.json({ erro: "A foto do produto é obrigatória." }, { status: 400 });
  const imagem = img.imagem;

  const fch = lerFicha(form);
  if (fch.erro) return fch.erro;
  const ficha = fch.ficha;

  try {
    // Nasce ATIVO: o gestor acabou de cadastrar querendo usar. `ativo` é flag de negócio —
    // arquivar é ato deliberado depois, não estado inicial (ver docs/spec-dashboard-catalogo-por-perfil.md).
    const dados = { ...parsed.data, codigo, ativo: true, imagemPath: "", fichaTecnicaPath: null };
    await prisma.produtoCustom.create({
      data: {
        codigo,
        dados,
        imagem: Buffer.from(await imagem.arrayBuffer()),
        imagemMime: imagem.type,
        ...(ficha ? { ficha: Buffer.from(await ficha.arrayBuffer()), fichaMime: ficha.type } : {}),
        autor: email,
      },
    });
    return NextResponse.json({ ok: true, codigo }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ erro: `O código ${codigo} já existe no catálogo.` }, { status: 409 });
    }
    return respostaErro(e, "Falha ao cadastrar o produto", 500);
  }
}

// Edição do que foi cadastrado pela tela. O Mateus pediu no áudio de 05/08: "você cadastrou,
// tem que deixar uma opção para eu, como administrador, adicionar, excluir ou editar" — sem
// isso, corrigir um erro de digitação exigia apagar o produto e cadastrar tudo de novo.
//
// O CÓDIGO é imutável de propósito: ele é a chave da linha E o que monta os caminhos
// `/api/produtos/<codigo>/imagem|ficha`. Renomear deixaria toda proposta já gerada apontando
// a foto para um código que não existe mais. Para trocar de código: apaga e cadastra.
//
// Produto do JSON continua fora — ele é versionado no git (spec-cadastro-produto.md).
export async function PUT(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;

  const form = await lerForm(req);
  if (!form) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });

  const parsed = EntradaEdicao.safeParse(dadosCrus(form));
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados do produto inválidos.", detalhe: parsed.error.flatten() }, { status: 400 });
  }
  const codigo = parsed.data.codigo.trim().toUpperCase();

  const atual = await prisma.produtoCustom.findUnique({ where: { codigo }, select: { dados: true, fichaMime: true } });
  if (!atual) {
    // 404 e não 403: o gestor PODE editar — este produto específico é que não mora no banco.
    // A mensagem precisa dizer o que fazer, senão vira "o botão de salvar não funciona".
    return NextResponse.json(
      { erro: `${codigo} não é um produto cadastrado pela tela — os 150 da base vêm do catálogo versionado e não se editam por aqui.` },
      { status: 404 },
    );
  }

  const img = lerImagem(form);
  if (img.erro) return img.erro;
  const fch = lerFicha(form);
  if (fch.erro) return fch.erro;
  // Trocar a ficha e removê-la são pedidos distintos: sem o sinal explícito, "não anexei
  // nada" (o caso comum ao editar só o texto) apagaria a ficha que já estava lá.
  const removerFicha = String(form.get("removerFicha") ?? "") === "1";

  try {
    // `ativo` ausente preserva o estado atual — editar a descrição não é motivo para
    // desarquivar um produto que o gestor tinha tirado de circulação.
    const ativoAtual = Produto.safeParse(atual.dados);
    const dados = {
      ...parsed.data,
      codigo,
      ativo: parsed.data.ativo ?? (ativoAtual.success ? ativoAtual.data.ativo : true),
      imagemPath: "",
      fichaTecnicaPath: null,
    };
    await prisma.produtoCustom.update({
      where: { codigo },
      data: {
        dados,
        ...(img.imagem ? { imagem: Buffer.from(await img.imagem.arrayBuffer()), imagemMime: img.imagem.type } : {}),
        ...(fch.ficha
          ? { ficha: Buffer.from(await fch.ficha.arrayBuffer()), fichaMime: fch.ficha.type }
          : removerFicha
            ? { ficha: null, fichaMime: null }
            : {}),
      },
    });
    return NextResponse.json({ ok: true, codigo });
  } catch (e) {
    return respostaErro(e, "Falha ao salvar o produto", 500);
  }
}

const Remover = z.object({ codigo: z.string().min(1) });

// Só remove o que foi cadastrado pela tela — produto do JSON não é apagável por aqui (nem
// deveria: ele é versionado no git). Proposta já salva não quebra: o PropostaScope é
// snapshot, e `comImagensDoCatalogo` só recalcula enquanto o código existir.
export async function DELETE(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;
  const parsed = Remover.safeParse({ codigo: req.nextUrl.searchParams.get("codigo") });
  if (!parsed.success) return NextResponse.json({ erro: "Código não informado." }, { status: 400 });
  try {
    await prisma.produtoCustom.delete({ where: { codigo: parsed.data.codigo } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 });
  }
}
