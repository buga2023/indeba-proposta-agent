import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gerarImagem, sdDisponivel } from "@/lib/imagem/stable-diffusion";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ prompt: z.string().min(1).max(1500) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  if (!(await sdDisponivel())) {
    return NextResponse.json(
      { erro: "Stable Diffusion indisponível.", indisponivel: true },
      { status: 503 },
    );
  }

  try {
    const imagem = await gerarImagem(parsed.data.prompt);
    return NextResponse.json({ imagem });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao gerar a imagem." },
      { status: 502 },
    );
  }
}
