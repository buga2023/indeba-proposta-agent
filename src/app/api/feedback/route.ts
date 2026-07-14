import { NextRequest, NextResponse } from "next/server";
import { FeedbackRequest } from "@/lib/contracts";
import { registrarFeedback } from "@/lib/feedback/store";
import { aprenderComFeedback } from "@/lib/feedback/aprender";
import { validarSessao } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = FeedbackRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  // Registrar é a prioridade (o dataset). Best-effort, nunca derruba a resposta ao usuário.
  const usuario = (await validarSessao(req.cookies.get("sessao")?.value))?.email ?? "local";
  try {
    await registrarFeedback({ ...parsed.data, ts: new Date().toISOString(), usuario });
  } catch (e) {
    console.error("falha ao registrar feedback:", e);
  }

  // Aprender (indexar correção) pode falhar se Qdrant/Ollama estiverem fora — degrada sem erro.
  let aprendizado = { aprendido: false, detalhe: "Feedback registrado." };
  try {
    aprendizado = await aprenderComFeedback(parsed.data);
  } catch {
    aprendizado = { aprendido: false, detalhe: "Feedback registrado (indexação indisponível agora)." };
  }

  return NextResponse.json({ ok: true, ...aprendizado });
}
