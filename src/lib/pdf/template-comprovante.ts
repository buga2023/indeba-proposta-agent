/**
 * Comprovante de registro (áudio do Mateus, 31/08/2026: "em todos os registros, dê a
 * opção da gente também importar em PDF… não precisa estar com relatório bonitinho, mas
 * como se fosse um documento de comprovação, com a foto, com tudo que foi registrado").
 *
 * Duas exigências moldam o desenho, e nenhuma é estética:
 *
 * - "TUDO que foi registrado": os campos vêm prontos de quem conhece o registro
 *   (lib/comprovantes.ts) e são impressos como vierem. O template não escolhe o que
 *   mostrar — se escolhesse, um campo novo no registro sairia calado do comprovante.
 * - "documento de comprovação": cabeçalho com o id e o carimbo de emissão. É o que
 *   diferencia isto de um print de tela — dá para conferir contra o sistema depois.
 *
 * Sem tabela de preço, sem capa: "não precisa estar com relatório bonitinho".
 */

export type CampoComprovante = { rotulo: string; valor: string };

export type DocumentoComprovante = {
  titulo: string; // "Solicitação Comercial", "Registro de Prospecção"…
  registroId: string;
  campos: CampoComprovante[];
  /** Texto longo (observação/próximos passos) — impresso em bloco, não em linha. */
  textos: { rotulo: string; valor: string }[];
  /** Fotos já em data-URI. Documentos anexos (PDF/DOCX) só aparecem listados por nome. */
  fotos: string[];
  documentos: string[];
};

// O conteúdo é do usuário (cliente, observação, nome de arquivo) e vira HTML: escapar é
// obrigatório, não zelo. Sem isto, uma observação com "<img onerror=…>" executaria dentro
// do Chromium do render.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function comprovanteHtml(doc: DocumentoComprovante, logo: string): string {
  const emitido = new Date().toLocaleString("pt-BR");
  return `<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 11px; }
  .pg { padding: 0 14mm; }
  .top { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 16px; }
  .top img { height: 34px; }
  .top h1 { margin: 0; font-size: 16px; letter-spacing: -.3px; }
  .top .meta { margin-left: auto; text-align: right; font-size: 8.5px; color: #64748b; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  td.rot { width: 32%; background: #f8fafc; font-weight: 700; color: #475569; }
  .bloco { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 12px; }
  .bloco .rot { font-weight: 700; color: #475569; margin-bottom: 4px; }
  .bloco .txt { white-space: pre-wrap; line-height: 1.5; }
  h2 { font-size: 12px; margin: 18px 0 8px; color: #1d4ed8; }
  /* Uma foto por linha e sem quebra no meio: é a prova, precisa sair legível. */
  .foto { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; margin-bottom: 10px; page-break-inside: avoid; }
  .foto img { display: block; width: 100%; max-height: 105mm; object-fit: contain; }
  ul { margin: 0; padding-left: 16px; line-height: 1.7; }
  .nota { color: #64748b; font-size: 9px; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; line-height: 1.5; }
  </style></head><body><div class="pg">
  <div class="top">
    ${logo ? `<img src="${logo}" alt="Indeba">` : ""}
    <h1>${esc(doc.titulo)}</h1>
    <div class="meta">Registro <b>${esc(doc.registroId)}</b><br>Emitido em ${esc(emitido)}</div>
  </div>

  <table>${doc.campos.map((c) => `<tr><td class="rot">${esc(c.rotulo)}</td><td>${esc(c.valor) || "—"}</td></tr>`).join("")}</table>

  ${doc.textos
    .filter((t) => t.valor.trim())
    .map((t) => `<div class="bloco"><div class="rot">${esc(t.rotulo)}</div><div class="txt">${esc(t.valor)}</div></div>`)
    .join("")}

  ${doc.fotos.length ? `<h2>Fotos (${doc.fotos.length})</h2>` + doc.fotos.map((f) => `<div class="foto"><img src="${f}"></div>`).join("") : ""}

  ${
    doc.documentos.length
      ? `<h2>Documentos anexados (${doc.documentos.length})</h2><ul>${doc.documentos.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : ""
  }

  <div class="nota">Documento gerado automaticamente pelo sistema Indeba a partir do registro ${esc(doc.registroId)}.
  Os anexos em formato de documento são apenas listados aqui — o conteúdo original continua disponível no sistema.</div>
  </div></body></html>`;
}
