import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { anexarFotoVisita, MAX_FOTOS_VISITA } from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Anexar UMA foto à visita (áudio do Mateus, 25/08/2026: até 10 por visita — o João bate
// foto dos equipamentos). Uma por requisição: a função da Vercel corta o corpo em ~4,5 MB,
// então o lote inteiro num POST só não caberia; a tela envia em sequência.
const LIMITE_FOTO = 4 * 1024 * 1024;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ erro: "Foto não enviada." }, { status: 400 });
  }
  if (!arquivo.type.startsWith("image/")) {
    return NextResponse.json({ erro: "O anexo de foto deve ser uma imagem." }, { status: 400 });
  }
  if (arquivo.size > LIMITE_FOTO) {
    return NextResponse.json({ erro: "Foto acima de 4 MB — a plataforma recusa envios maiores." }, { status: 400 });
  }

  try {
    const r = await anexarFotoVisita(usuario, id, { bytes: new Uint8Array(await arquivo.arrayBuffer()), mime: arquivo.type });
    if (r === "nao_encontrada") return NextResponse.json({ erro: "Visita não encontrada." }, { status: 404 });
    if (r === "cheia") return NextResponse.json({ erro: `A visita já tem ${MAX_FOTOS_VISITA} fotos.` }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao anexar a foto.", 500);
  }
}
