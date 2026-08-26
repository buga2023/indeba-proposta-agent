import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { anexarDocumentoVisita, documentoDaVisita } from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Documento da visita (áudio do Mateus, 25/08/2026: um por visita — a assinatura que o
// João colhe). PDF ou imagem (assinatura escaneada costuma virar foto), até 4 MB — o
// mesmo teto de ~4,5 MB da função da Vercel dos outros uploads.
const LIMITE_DOC = 4 * 1024 * 1024;
const MIME_ACEITOS = (m: string) => m === "application/pdf" || m.startsWith("image/");

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("documento");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ erro: "Documento não enviado." }, { status: 400 });
  }
  if (!MIME_ACEITOS(arquivo.type)) {
    return NextResponse.json({ erro: "O documento deve ser um PDF ou uma imagem." }, { status: 400 });
  }
  if (arquivo.size > LIMITE_DOC) {
    return NextResponse.json({ erro: "Documento acima de 4 MB — a plataforma recusa envios maiores." }, { status: 400 });
  }

  try {
    const ok = await anexarDocumentoVisita(usuario, id, {
      bytes: new Uint8Array(await arquivo.arrayBuffer()),
      mime: arquivo.type,
      nome: arquivo.name.slice(0, 200),
    });
    if (!ok) return NextResponse.json({ erro: "Visita não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao anexar o documento.", 500);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const doc = await documentoDaVisita(usuario, id);
    if (!doc) return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
    const nome = (doc.nome ?? "documento").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "documento";
    return new NextResponse(new Uint8Array(doc.bytes), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Disposition": `inline; filename="${nome}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao abrir o documento.", 500);
  }
}
