import { NextRequest, NextResponse } from "next/server";
import { extrairTextoContrato } from "@/lib/contrato/extrair-texto";
import { estruturarOrcamento, matchCatalogo } from "@/lib/orcamento/importar";
import { carregarCatalogo } from "@/lib/catalogo";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 120; // extração de PDF + IA estruturando podem levar mais de 60s

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

// Recebe o orçamento (multipart, campo "arquivo"), extrai o texto (determinístico,
// mesmo extrator do contrato) e estrutura via IA com guarda de preço. A resposta
// alimenta a tela de conferência — nada vira proposta sem o vendedor revisar.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ erro: "Envie o arquivo como multipart/form-data." }, { status: 400 });
  }

  const file = form.get("arquivo");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Campo 'arquivo' ausente." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo muito grande (máx 15MB)." }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const texto = await extrairTextoContrato(bytes, file.name);
    const { extraido, rejeitados } = await estruturarOrcamento(texto);
    // Casamento determinístico com o catálogo: dá foto/descrição ao PDF.
    // O preço segue o do orçamento — o catálogo pode nem ter valor.
    // Sem filtro de `ativo` aqui de propósito (diferente do matcher de seleção por IA
    // e do índice RAG): `ativo` marca "precificado no catálogo", mas o preço deste
    // fluxo NUNCA vem do catálogo — vem do próprio orçamento, já validado por
    // precoConstaNoTexto(). Filtrar por `ativo` só esconderia foto/ficha de produtos
    // reais (a maior parte do catálogo hoje) sem nenhum ganho de segurança de preço.
    const produtos = carregarCatalogo().produtos;
    const itens = extraido.itens.map((it) => {
      const p = matchCatalogo(it.nome, produtos);
      return { ...it, codigoCatalogo: p?.codigo ?? null, nomeCatalogo: p?.nome ?? null };
    });
    return NextResponse.json({ extraido: { ...extraido, itens }, rejeitados, nomeArquivo: file.name, chars: texto.length });
  } catch (e) {
    // Mensagens curadas do fluxo (sem internals) vão direto pro vendedor; o resto é genérico.
    if (e instanceof Error && /^(IA indisponível|Formato não suportado|Não consegui extrair)/.test(e.message)) {
      return NextResponse.json({ erro: e.message }, { status: 422 });
    }
    return respostaErro(e, "Falha ao importar o orçamento.", 422);
  }
}
