import { NextResponse } from "next/server";
import { carregarCatalogo } from "@/lib/catalogo";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// A ficha rica (indicadoPara/benefícios/diluições/características/rendimento) existe pro
// PDF, e o PDF é montado NO SERVIDOR: montar.ts copia a ficha do catálogo direto pro
// PropostaScope, sem passar pelo browser. O cliente só lê `titulo` e `descricao` (tela de
// Catálogo) — o assistente (ajuda-chat-logic) nem toca em `ficha`. Mandar o resto era
// 104 KB por request, 45% do payload, que nenhuma tela abria. Todos os campos de
// FichaProduto são opcionais, então o recorte continua válido no contrato.
// Memoizado: `carregarCatalogo` já cacheia em processo, então o mapa roda uma vez por
// instância, não a cada request. Nunca mutar o objeto do cache — daí o spread.
let enxuto: ReturnType<typeof carregarCatalogo> | null = null;
function catalogoParaCliente() {
  if (enxuto) return enxuto;
  const catalogo = carregarCatalogo();
  enxuto = {
    ...catalogo,
    produtos: catalogo.produtos.map((p) => ({
      ...p,
      ficha: p.ficha ? { titulo: p.ficha.titulo, descricao: p.ficha.descricao } : p.ficha,
    })),
  };
  return enxuto;
}

// Catálogo real (data/catalogo.json) — fonte da verdade dos dados críticos.
// Leitura para a tela de Catálogo; preço/embalagem nunca vêm da IA (constituição §1).
export async function GET() {
  try {
    const catalogo = catalogoParaCliente();
    // ~330 KB de JSON (150 produtos com ficha completa) que só muda em deploy — é dado
    // estático do repositório, não do banco. Sem cache, a tela refetchava a cada visita
    // e os logs de produção mostravam /api/catalogo várias vezes por minuto, sempre com
    // o payload inteiro. `private` de propósito: a resposta passa pelo middleware de
    // auth, então não pode ficar em cache compartilhado de CDN — só no browser de quem
    // já está autenticado.
    return NextResponse.json(catalogo, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar catálogo", 500);
  }
}
