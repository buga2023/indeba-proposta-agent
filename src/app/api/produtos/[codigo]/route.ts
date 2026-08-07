import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { carregarCatalogo, produtoPorCodigoCompleto } from "@/lib/catalogo";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// UM produto, INTEIRO, para abrir o formulário de edição.
//
// Existe por causa de uma perda de dados real: a tela do Catálogo é alimentada por
// /api/catalogo, que recorta a ficha para título e descrição (são 104 KB por request que
// nenhuma tela abria). O formulário partia daquele produto recortado e devolvia no PUT um
// produto sem benefícios, diluições, características nem subtítulo — o gestor trocava a foto
// e via o resto da ficha sumir (relato do Matheus, 06/08/2026).
//
// O merge do PUT (lib/produto-merge.ts) é a segunda defesa; esta é a primeira, e a que faz o
// gestor VER na tela o que ele está prestes a salvar.
export async function GET(req: NextRequest, ctx: { params: Promise<{ codigo: string }> }) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  // Mesmo gate do resto da rota: quem edita catálogo é o gestor, e a ficha completa é
  // exatamente o payload que a listagem enxuta evita entregar a quem não vai editar.
  if (u.papel !== "admin") return NextResponse.json({ erro: "Só o gestor edita produto." }, { status: 403 });

  const { codigo: cru } = await ctx.params;
  const codigo = decodeURIComponent(cru);
  try {
    const produto = await produtoPorCodigoCompleto(codigo);
    if (!produto) return NextResponse.json({ erro: `${codigo} não existe no catálogo.` }, { status: 404 });
    return NextResponse.json({
      produto,
      // Quem edita merece saber que o ajuste vira override do arquivo versionado.
      daBase: carregarCatalogo().produtos.some((p) => p.codigo === codigo),
    });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar o produto", 500);
  }
}
