import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { usuarioAtual } from "@/lib/chamados";
import { dispararCobranca } from "@/lib/contatos";
import { Inadimplente } from "@/lib/contracts";

export const runtime = "nodejs";
export const maxDuration = 30;

// Body do disparo: a lista de inadimplentes (já calculada pelo motor §2) + total.
// Validar com Zod fecha o vetor de e-mail arbitrário — destinatário/corpo iam crus do
// body pro webhook n8n. A estrutura tem que bater com o que o motor produz.
const DispararRequest = z.object({
  inadimplentes: z.array(Inadimplente).min(1),
  totalDevido: z.string().default("0.00"),
});

// Dispara o webhook do n8n: e-mail de cobrança a cada cliente + resumo ao gestor.
// Ação sensível — envia e-mail EM NOME DA EMPRESA → exige papel admin (não só login).
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") {
    return NextResponse.json({ erro: "Apenas administradores podem disparar cobranças." }, { status: 403 });
  }

  const parsed = DispararRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  try {
    const r = await dispararCobranca(parsed.data.inadimplentes, parsed.data.totalDevido);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao disparar a cobrança." },
      { status: 502 },
    );
  }
}
