import { NextRequest, NextResponse } from "next/server";
import { InstagramRequest } from "@/lib/contracts";
import { gerarPostsInstagram } from "@/lib/llm/gerar-instagram";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = InstagramRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const res = await gerarPostsInstagram(parsed.data);
    return NextResponse.json(res);
  } catch (e) {
    return respostaErro(e, "Falha ao gerar os posts.", 500);
  }
}
