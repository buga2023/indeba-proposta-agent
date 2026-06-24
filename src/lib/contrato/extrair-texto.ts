/**
 * Extração de texto de contrato anexado (PDF / DOCX / TXT) — DETERMINÍSTICA.
 *
 * Alimenta a ação `analisar` do agente de contrato: o vendedor anexa o arquivo do
 * computador; aqui extraímos o texto cru (sem IA — extração é mecânica) e o passamos
 * ao analisador. PDF via pdfjs-dist, DOCX via mammoth, TXT decodificado direto.
 */
import mammoth from "mammoth";

export type FormatoContrato = "pdf" | "docx" | "txt";

// Casa com ContratoRequest.analisar (texto.max = 200_000).
const LIMITE_CHARS = 200_000;

export function formatoDe(nome: string): FormatoContrato | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt" || ext === "text") return "txt";
  return null;
}

async function extrairPdf(bytes: Uint8Array): Promise<string> {
  // Build legacy roda em Node; specifier por variável evita resolução estática de tipos
  // do subpath (sem .d.ts próprio) — tipamos como o pacote raiz, mesma API.
  const spec = "pdfjs-dist/legacy/build/pdf.mjs";
  const pdfjs = (await import(spec)) as typeof import("pdfjs-dist");
  const tarefa = pdfjs.getDocument({ data: bytes });
  const doc = await tarefa.promise;
  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const itens = content.items as Array<{ str?: string }>;
    paginas.push(itens.map((it) => it.str ?? "").join(" "));
  }
  await tarefa.destroy();
  return paginas.join("\n");
}

async function extrairDocx(bytes: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

// bytes do arquivo + nome (pra detectar o formato) -> texto cru normalizado. Lança em
// formato não suportado ou texto vazio (lacuna sinalizada, não string vazia silenciosa).
export async function extrairTextoContrato(bytes: Uint8Array, nome: string): Promise<string> {
  const fmt = formatoDe(nome);
  if (!fmt) throw new Error(`Formato não suportado: ${nome}. Anexe PDF, DOCX ou TXT.`);

  let texto: string;
  if (fmt === "pdf") texto = await extrairPdf(bytes);
  else if (fmt === "docx") texto = await extrairDocx(bytes);
  else texto = new TextDecoder("utf-8").decode(bytes);

  texto = texto.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!texto) {
    throw new Error("Não consegui extrair texto do arquivo (vazio ou PDF só de imagem/escaneado?).");
  }
  return texto.slice(0, LIMITE_CHARS);
}
