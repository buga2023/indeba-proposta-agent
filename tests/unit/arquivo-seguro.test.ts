import { describe, expect, it } from "vitest";
import { arquivoValidado, detectarMime, disposicaoDeEntrega, TIPOS_IMAGEM } from "@/lib/arquivo-seguro";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const pdf = new TextEncoder().encode("%PDF-1.4\n%âãÏÓ\n1 0 obj");
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/api/colaboradores")</script></svg>');

describe("detectarMime — assinatura dos bytes, não o que o navegador declara", () => {
  it("reconhece PNG, JPEG, WebP e PDF", () => {
    expect(detectarMime(png)).toBe("image/png");
    expect(detectarMime(jpeg)).toBe("image/jpeg");
    expect(detectarMime(webp)).toBe("image/webp");
    expect(detectarMime(pdf)).toBe("application/pdf");
  });
  it("SVG, HTML e arquivo curto não são nada aceito", () => {
    expect(detectarMime(svg)).toBeNull();
    expect(detectarMime(new TextEncoder().encode("<html><script>1</script></html>"))).toBeNull();
    expect(detectarMime(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe("arquivoValidado", () => {
  it("SVG declarado como image/svg+xml é recusado mesmo pedindo 'imagem'", async () => {
    const f = new File([svg], "foto.svg", { type: "image/svg+xml" });
    const r = await arquivoValidado(f, TIPOS_IMAGEM, "A foto");
    expect(r.erro).toMatch(/PNG, JPG, WebP/);
  });
  it("JPEG declarado como PNG entra com o tipo REAL", async () => {
    const f = new File([jpeg], "foto.png", { type: "image/png" });
    const r = await arquivoValidado(f, TIPOS_IMAGEM, "A foto");
    expect(r.erro).toBeNull();
    if (r.erro === null) {
      expect(r.mime).toBe("image/jpeg");
      expect(r.arquivo.type).toBe("image/jpeg");
      expect(r.arquivo.name).toBe("foto.png");
    }
  });
  it("PDF não entra onde só imagem é aceita", async () => {
    const f = new File([pdf], "doc.pdf", { type: "application/pdf" });
    expect((await arquivoValidado(f, TIPOS_IMAGEM, "A foto")).erro).toBeTruthy();
  });
});

describe("disposicaoDeEntrega", () => {
  it("allowlist sai inline; tipo desconhecido gravado antes vira download opaco", () => {
    expect(disposicaoDeEntrega("image/png", "a b.png")["Content-Disposition"]).toBe('inline; filename="a_b.png"');
    const svgAntigo = disposicaoDeEntrega("image/svg+xml", "x.svg");
    expect(svgAntigo["Content-Type"]).toBe("application/octet-stream");
    expect(svgAntigo["Content-Disposition"]).toMatch(/^attachment/);
  });
});
