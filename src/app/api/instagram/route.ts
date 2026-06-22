import { NextRequest, NextResponse } from "next/server";
import { InstagramRequest } from "@/lib/contracts";
import { gerarPostsInstagram } from "@/lib/llm/gerar-instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = InstagramRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const res = await gerarPostsInstagram(parsed.data);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao gerar os posts." },
      { status: 500 },
    );
  }
}
