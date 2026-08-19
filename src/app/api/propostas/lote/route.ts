import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth-db";
import { excluirPropostasArquivadas } from "@/lib/propostas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Exclusão definitiva em LOTE — o "esvaziar excluídas" da aba Excluídas.
// Antes cada proposta era um DELETE /api/propostas/[id]; apagar 20 propostas
// eram 20 invocações de função na Vercel e 20 tiques no rate limit (o que
// chegava a bloquear até o login). Aqui é UMA requisição, UM deleteMany.
//
// Mesmos freios da rota individual: só admin, e o deleteMany só alcança
// propostas com status "arquivada" — id ativo no meio da lista é ignorado.
const Corpo = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });

export async function DELETE(req: NextRequest) {
  const parsed = Corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const usuario = await usuarioAtual(req);
    // Falha FECHADA (mesma razão da rota individual): sem sessão, nega.
    if (!usuario || usuario.papel !== "admin") {
      return NextResponse.json({ erro: "Apenas o administrador pode excluir definitivamente." }, { status: 403 });
    }
    const apagadas = await excluirPropostasArquivadas(parsed.data.ids);
    return NextResponse.json({ ok: true, apagadas });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir as propostas", 500);
  }
}
