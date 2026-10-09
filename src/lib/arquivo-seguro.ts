// Upload confiava no MIME que o NAVEGADOR declara (`File.type`), e `image/*` inclui
// `image/svg+xml`: um SVG com <script> anexado como "foto" e servido `inline` executa na
// origem do app, com a sessão de quem abriu (XSS armazenado — revisão de segurança,
// 08/10/2026). Aqui o tipo sai dos PRIMEIROS BYTES do arquivo, numa allowlist fechada, e o
// que não bate não entra. Sem dependência: quatro assinaturas bastam para o que o app aceita.

export const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"] as const;
export const TIPOS_DOCUMENTO = ["application/pdf", ...TIPOS_IMAGEM] as const;
export type TipoAceito = (typeof TIPOS_DOCUMENTO)[number];

export function detectarMime(bytes: Uint8Array): TipoAceito | null {
  if (bytes.length < 12) return null;
  const b = (i: number) => bytes[i];
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) return "image/png";
  // JPEG: FF D8 FF
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  // WebP: "RIFF" .... "WEBP"
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  // PDF: "%PDF-" (alguns geradores põem BOM/espaços antes; toleramos até 8 bytes de prefixo)
  const cabeca = String.fromCharCode(...bytes.subarray(0, 13));
  if (cabeca.includes("%PDF-")) return "application/pdf";
  return null;
}

/** Valida um upload pelos bytes e devolve um `File` com o tipo REAL (não o declarado), para
 *  que o resto do fluxo grave `mime` correto sem precisar mudar de assinatura. */
export async function arquivoValidado(
  arquivo: File,
  aceitos: readonly TipoAceito[],
  rotulo: string,
): Promise<{ erro: string } | { erro: null; arquivo: File; mime: TipoAceito; bytes: Uint8Array<ArrayBuffer> }> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = detectarMime(bytes);
  if (!mime || !aceitos.includes(mime)) {
    const lista = aceitos.map((m) => NOME[m]).join(", ");
    return { erro: `${rotulo} deve ser ${lista} — o conteúdo do arquivo não é um desses formatos.` };
  }
  return { erro: null, arquivo: new File([bytes], arquivo.name, { type: mime }), mime, bytes };
}

const NOME: Record<TipoAceito, string> = { "image/png": "PNG", "image/jpeg": "JPG", "image/webp": "WebP", "application/pdf": "PDF" };

/** Como entregar bytes gravados: `inline` só para a allowlist. Anexo antigo gravado com outro
 *  tipo (ex.: SVG de antes desta validação) sai como download, nunca renderizado na origem. */
export function disposicaoDeEntrega(mime: string, nome: string): { "Content-Type": string; "Content-Disposition": string } {
  const seguro = (TIPOS_DOCUMENTO as readonly string[]).includes(mime);
  const limpo = nome.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "arquivo";
  return {
    "Content-Type": seguro ? mime : "application/octet-stream",
    "Content-Disposition": `${seguro ? "inline" : "attachment"}; filename="${limpo}"`,
  };
}
