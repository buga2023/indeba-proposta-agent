import { NextResponse } from "next/server";
import { carregarCatalogo } from "@/lib/catalogo";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Catálogo real (data/catalogo.json) — fonte da verdade dos dados críticos.
// Leitura para a tela de Catálogo; preço/embalagem nunca vêm da IA (constituição §1).
export async function GET() {
  try {
    const catalogo = carregarCatalogo();
    return NextResponse.json(catalogo);
  } catch (e) {
    return respostaErro(e, "Falha ao carregar catálogo", 500);
  }
}
