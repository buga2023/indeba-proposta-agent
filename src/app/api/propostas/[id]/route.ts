import { NextRequest, NextResponse } from "next/server";
import { StatusUpdate } from "@/lib/contracts";
import { obterProposta, atualizarStatusProposta } from "@/lib/propostas";

export const runtime = "nodejs";

// Carrega a proposta completa (com o scope) — para reabrir/editar ou gerar contrato
// de uma proposta que já existe.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const registro = await obterProposta(id);
    if (!registro) return NextResponse.json({ erro: "Proposta não encontrada." }, { status: 404 });
    return NextResponse.json(registro);
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao carregar a proposta" },
      { status: 500 },
    );
  }
}

// Muda o status comercial (enviada/aprovada/recusada/...). Só o status é mutável aqui;
// preço e itens vêm sempre do scope (constituição §2).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = StatusUpdate.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await atualizarStatusProposta(id, parsed.data.status));
  } catch (e) {
    // update num id inexistente → Prisma lança; tratamos como 404.
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao atualizar o status" },
      { status: 404 },
    );
  }
}
