import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { catalogoCompleto } from "@/lib/catalogo";
import { prisma } from "@/lib/db";
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
//
// Com o cadastro pela tela o catálogo deixou de ser imutável entre deploys, e um cache
// puro esconderia o produto recém-cadastrado até o próximo redeploy — o gestor salvaria,
// não veria nada e cadastraria de novo. A chave é uma ASSINATURA barata da segunda fonte
// (quantos produtos e quando o último mudou): uma agregação que o Postgres responde pelo
// índice, e que muda a cada cadastro, edição ou remoção.
let cache: { corpo: string; etag: string; assinatura: string } | null = null;

async function assinaturaCustom(): Promise<string> {
  try {
    const r = await prisma.produtoCustom.aggregate({ _count: { _all: true }, _max: { atualizadoEm: true } });
    return `${r._count._all}:${r._max.atualizadoEm?.getTime() ?? 0}`;
  } catch {
    return "indisponivel"; // banco fora: `catalogoCompleto` degrada para o JSON
  }
}

async function catalogoParaCliente() {
  const assinatura = await assinaturaCustom();
  if (cache && cache.assinatura === assinatura) return cache;
  const catalogo = await catalogoCompleto();
  const corpo = JSON.stringify({
    ...catalogo,
    produtos: catalogo.produtos.map((p) => ({
      ...p,
      ficha: p.ficha ? { titulo: p.ficha.titulo, descricao: p.ficha.descricao } : p.ficha,
    })),
  });
  cache = { corpo, etag: `"${createHash("sha1").update(corpo).digest("base64url")}"`, assinatura };
  return cache;
}

// Catálogo real (data/catalogo.json) — fonte da verdade dos dados críticos.
// Leitura para a tela de Catálogo; preço/embalagem nunca vêm da IA (constituição §1).
export async function GET(req: NextRequest) {
  try {
    const { corpo, etag } = await catalogoParaCliente();

    // Revalidação por ETag em vez de janela de tempo. A primeira tentativa foi
    // `max-age=300`, e ela mordeu na hora de validar um deploy: o catálogo mudou, o
    // browser seguiu servindo o antigo do cache e o produto corrigido não aparecia por
    // 5 minutos. Com `no-cache` o browser SEMPRE pergunta, mas quando nada mudou a
    // resposta é um 304 vazio — economiza os mesmos ~128 KB sem nunca entregar dado
    // velho. `private`: a resposta passa pelo middleware de auth e não pode parar em
    // cache compartilhado de CDN.
    const headers = { "Cache-Control": "private, no-cache", ETag: etag };
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers });
    }
    return new NextResponse(corpo, {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar catálogo", 500);
  }
}
