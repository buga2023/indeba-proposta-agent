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

// `imagemPath`/`fichaTecnicaPath` são DERIVADOS do código na leitura (produto-custom.ts), e
// `ativo` é decidido aqui — por isso o formulário não os envia. Aceitar `imagemPath` do
// cliente deixaria um cadastro apontar a foto do produto para qualquer URL.
const Entrada = Produto.omit({ imagemPath: true, fichaTecnicaPath: true, ativo: true });

export async function POST(req: NextRequest) {
  const { erro, email } = await exigirGestor(req);
  if (erro) return erro;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });
  }

  const parsed = Entrada.safeParse(JSON.parse(String(form.get("dados") ?? "null") || "null"));
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

  const imagem = form.get("imagem");
  if (!(imagem instanceof File) || imagem.size === 0) {
    return NextResponse.json({ erro: "A foto do produto é obrigatória." }, { status: 400 });
  }
  if (!IMAGEM_MIMES.includes(imagem.type)) {
    return NextResponse.json({ erro: "Foto deve ser PNG, JPG ou WebP." }, { status: 400 });
  }
  if (imagem.size > 5 * MB) {
    return NextResponse.json({ erro: "Foto acima de 5 MB." }, { status: 400 });
  }

  const ficha = form.get("ficha");
  const temFicha = ficha instanceof File && ficha.size > 0;
  if (temFicha && ficha.type !== "application/pdf") {
    return NextResponse.json({ erro: "A ficha técnica deve ser um PDF." }, { status: 400 });
  }
  if (temFicha && ficha.size > 20 * MB) {
    return NextResponse.json({ erro: "Ficha técnica acima de 20 MB." }, { status: 400 });
  }

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
        ...(temFicha ? { ficha: Buffer.from(await ficha.arrayBuffer()), fichaMime: ficha.type } : {}),
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
