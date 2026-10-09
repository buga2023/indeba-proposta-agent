// Helpers comuns dos templates de PDF. `esc` existia cinco vezes (template, consolidada,
// comercial, orçamento, capa-express) em duas variantes — uma sem escapar aspas simples e
// outra que quebrava com null. Esta é a união: tolera null e escapa as cinco entidades
// (revisão de arquitetura, 08/10/2026, item #24).
export const esc = (s: string | null | undefined): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const brl = (v: string | number): string =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
