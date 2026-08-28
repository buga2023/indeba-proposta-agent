import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { anexar, excluirAnexo, MAX_ANEXOS_POR_CATEGORIA } from "@/lib/anexos";
import { TipoRegistroAnexo, CategoriaAnexo } from "@/lib/contracts";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Anexos das ferramentas (áudio do Mateus, 27/08/2026: anexar foto e documento em todas
// as ferramentas). UM arquivo por requisição — cada uma fica abaixo do teto de ~4,5 MB da
// função da Vercel; a tela envia em sequência, mesmo desenho de /api/visitas/<id>/fotos.
const LIMITE = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const tipo = TipoRegistroAnexo.safeParse(form?.get("registroTipo"));
  const categoria = CategoriaAnexo.safeParse(form?.get("categoria"));
  const registroId = form?.get("registroId");
  const arquivo = form?.get("arquivo");
  if (!tipo.success || !categoria.success || typeof registroId !== "string" || !registroId) {
    return NextResponse.json({ erro: "Informe registroTipo, registroId e categoria válidos." }, { status: 400 });
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ erro: "Arquivo não enviado." }, { status: 400 });
  }
  if (categoria.data === "foto" && !arquivo.type.startsWith("image/")) {
    return NextResponse.json({ erro: "O anexo de foto deve ser uma imagem." }, { status: 400 });
  }
  if (categoria.data === "documento" && arquivo.type !== "application/pdf" && !arquivo.type.startsWith("image/")) {
    return NextResponse.json({ erro: "O documento deve ser um PDF ou uma imagem." }, { status: 400 });
  }
  if (arquivo.size > LIMITE) {
    return NextResponse.json({ erro: "Arquivo acima de 4 MB — a plataforma recusa envios maiores." }, { status: 400 });
  }

  try {
    const r = await anexar(usuario, tipo.data, registroId, categoria.data, {
      bytes: new Uint8Array(await arquivo.arrayBuffer()),
      mime: arquivo.type,
      nome: arquivo.name.slice(0, 200),
    });
    if (r === "nao_encontrado") return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
    if (r === "cheio") {
      return NextResponse.json({ erro: `O registro já tem ${MAX_ANEXOS_POR_CATEGORIA} anexos desta categoria.` }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao anexar o arquivo.", 500);
  }
}

// Tirar anexo errado (áudio do Mateus, 27/08/2026): quem pode editar o registro pode
// excluir e substituir os anexos dele.
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Informe o id do anexo." }, { status: 400 });
  try {
    const ok = await excluirAnexo(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Anexo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir o anexo.", 500);
  }
}
