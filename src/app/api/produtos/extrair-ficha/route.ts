import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { usuarioAtual } from "@/lib/auth-db";
import { produtoPorCodigoCompleto } from "@/lib/catalogo";
import { extrairTextoContrato } from "@/lib/contrato/extrair-texto";
import { camposDaFicha } from "@/lib/ficha-tecnica-parse";
import { fichaDoProduto } from "@/lib/produto-custom";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// "Preencher a partir da ficha" — o botão do formulário de produto.
//
// Duas entradas, porque o gestor chega de dois jeitos: com o PDF ainda no computador
// (multipart, antes de salvar) ou com o produto já tendo ficha anexada (`?codigo=`).
// Devolve os campos SUGERIDOS; quem confirma é ele, no formulário. Nada é gravado aqui.
//
// A extração é determinística (lib/ficha-tecnica-parse.ts): o texto sai do PDF como está
// escrito. Composição e diluição são dado técnico — o tipo de coisa que a constituição §1
// proíbe deixar um modelo redigir.
const MB = 1024 * 1024;

async function bytesDaFichaGravada(codigo: string): Promise<{ bytes: Uint8Array; nome: string } | null> {
  const propria = await fichaDoProduto(codigo);
  if (propria) return { bytes: new Uint8Array(propria.bytes), nome: `${codigo}.pdf` };
  // Ficha herdada da base: o arquivo está versionado em public/fichas-tecnicas/. O caminho
  // vem do catálogo (fonte nossa), nunca do cliente — não há travessia possível por aqui.
  const produto = await produtoPorCodigoCompleto(codigo);
  const caminho = produto?.fichaTecnicaPath;
  if (!caminho || !caminho.startsWith("/fichas-tecnicas/")) return null;
  try {
    const arquivo = await readFile(join(process.cwd(), "public", caminho.replace(/^\//, "")));
    return { bytes: new Uint8Array(arquivo), nome: caminho.split("/").pop() ?? `${codigo}.pdf` };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (u.papel !== "admin") return NextResponse.json({ erro: "Só o gestor cadastra produto." }, { status: 403 });

  let origem: { bytes: Uint8Array; nome: string } | null = null;
  const tipo = req.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      const ficha = form.get("ficha");
      if (!(ficha instanceof File) || ficha.size === 0) {
        return NextResponse.json({ erro: "Anexe a ficha técnica em PDF." }, { status: 400 });
      }
      if (ficha.type !== "application/pdf") {
        return NextResponse.json({ erro: "A ficha técnica deve ser um PDF." }, { status: 400 });
      }
      if (ficha.size > 20 * MB) return NextResponse.json({ erro: "Ficha técnica acima de 20 MB." }, { status: 400 });
      origem = { bytes: new Uint8Array(await ficha.arrayBuffer()), nome: ficha.name || "ficha.pdf" };
    } else {
      const codigo = req.nextUrl.searchParams.get("codigo");
      if (!codigo) return NextResponse.json({ erro: "Informe o produto ou anexe o PDF." }, { status: 400 });
      origem = await bytesDaFichaGravada(codigo);
      if (!origem) {
        return NextResponse.json({ erro: "Este produto ainda não tem ficha técnica anexada." }, { status: 404 });
      }
    }
  } catch {
    return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });
  }

  try {
    const texto = await extrairTextoContrato(origem.bytes, origem.nome);
    const campos = camposDaFicha(texto);
    // Descrição sozinha NÃO conta como leitura bem-sucedida: na falta de cabeçalho, ela é só
    // o começo do texto — pode ser o cabeçalho da empresa de um PDF fora do padrão. O sinal
    // de que a ficha foi reconhecida é ter saído ao menos um bloco estruturado.
    const estruturados = campos.composicao || campos.aplicacao || campos.modoDeUso || campos.beneficios?.length || campos.caracteristicas;
    if (!estruturados) {
      // Ficha escaneada (imagem) ou fora do padrão: dizer isso é melhor do que devolver um
      // punhado de texto solto e deixar o gestor achando que aquilo é a ficha lida.
      return NextResponse.json(
        { erro: "Não reconheci os blocos desta ficha (composição, aplicação, modo de uso). Preencha os campos à mão." },
        { status: 422 },
      );
    }
    return NextResponse.json({ campos });
  } catch (e) {
    // extrairTextoContrato lança com a razão em português (PDF só de imagem, formato) — ela
    // é útil para quem está com o arquivo na mão, então sobe como está.
    if (e instanceof Error && /extrair|Formato/i.test(e.message)) {
      return NextResponse.json({ erro: e.message }, { status: 422 });
    }
    return respostaErro(e, "Falha ao ler a ficha técnica", 500);
  }
}
