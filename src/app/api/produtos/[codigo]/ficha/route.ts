import { NextRequest, NextResponse } from "next/server";
import { fichaDoProduto } from "@/lib/produto-custom";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Ficha técnica (PDF) do produto cadastrado pela tela — mesmo raciocínio da rota de imagem.
// É para onde o `fichaTecnicaPath` aponta, então o link "ficha técnica" do Catálogo abre
// normalmente. `inline` para o PDF abrir na aba, como os arquivos de public/fichas-tecnicas.
// Link aberto em nova aba (navegação) que cai num erro mostrava JSON cru. Para navegação
// (Accept: text/html) devolvemos uma página curta e legível; para fetch/API segue JSON.
function paginaAviso(titulo: string, texto: string, status: number) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><style>body{font-family:system-ui,Arial,sans-serif;background:#f4f7fb;color:#0f2744;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{background:#fff;border:1px solid #e3e8ef;border-radius:12px;padding:32px;max-width:420px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#5b6b82;margin:0 0 16px;line-height:1.5}button{background:#1E6BB8;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer}</style></head><body><main><h1>${titulo}</h1><p>${texto}</p><button onclick="window.close()">Fechar</button></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const navegacao = (req.headers.get("accept") ?? "").includes("text/html");
  let limpo: string;
  try {
    limpo = decodeURIComponent(codigo);
  } catch {
    return NextResponse.json({ erro: "Código inválido." }, { status: 400 });
  }
  try {
    const f = await fichaDoProduto(limpo);
    if (!f) {
      const msg = "Este produto não tem ficha técnica anexada. Anexe o PDF na edição do produto (Catálogo).";
      return navegacao ? paginaAviso("Ficha técnica indisponível", msg, 404) : NextResponse.json({ erro: msg }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(f.bytes), {
      headers: {
        "Content-Type": f.mime,
        // Nome do arquivo entre aspas e sem o que possa quebrar o header — o código é
        // [A-Z0-9-] na entrada, mas o header não é lugar de confiar em validação distante.
        "Content-Disposition": `inline; filename="${limpo.replace(/[^A-Za-z0-9._-]/g, "")}.pdf"`,
        // Sem `immutable`: a ficha pode ser trocada ou removida na edição do produto, e a
        // URL continua a mesma — cache imutável entregaria o PDF antigo depois da troca.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    if (navegacao) {
      console.error("[api] Falha ao carregar a ficha técnica", e);
      return paginaAviso("Não foi possível abrir a ficha", "Houve uma falha ao carregar a ficha técnica. Tente novamente em instantes.", 500);
    }
    return respostaErro(e, "Falha ao carregar a ficha técnica", 500);
  }
}
