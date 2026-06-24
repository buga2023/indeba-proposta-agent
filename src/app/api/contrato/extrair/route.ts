import { NextRequest, NextResponse } from "next/server";
import { extrairTextoContrato } from "@/lib/contrato/extrair-texto";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 30; // PDF grande pode levar alguns segundos

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

// Recebe o arquivo do contrato (multipart, campo "arquivo") e devolve o texto extraído,
// pronto para a ação "analisar" de /api/contrato. Extração 100% determinística (sem IA).
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ erro: "Envie o arquivo como multipart/form-data." }, { status: 400 });
  }

  const file = form.get("arquivo");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Campo 'arquivo' ausente." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo muito grande (máx 15MB)." }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const texto = await extrairTextoContrato(bytes, file.name);
    return NextResponse.json({ texto, nomeArquivo: file.name, chars: texto.length });
  } catch (e) {
    return respostaErro(e, "Falha ao extrair o texto do arquivo.", 422);
  }
}
