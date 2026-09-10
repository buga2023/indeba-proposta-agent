/**
 * Formatação de data para leitura humana. Módulo próprio, SEM dependência de PDF, e isso
 * não é organização: é o que mantém o deploy de pé.
 *
 * Estas funções nasceram dentro de lib/pdf/registro.ts, que importa o motor de render —
 * e o motor puxa o @sparticuz/chromium. Como ferramentas-tecnicas.ts e
 * ferramentas-comerciais.ts usam `dataBr`, TODA rota que fala com esses libs (visitas,
 * comodatos, estoque, fotos, documento…) passou a empacotar o navegador junto. O build
 * passava e o "Deploying outputs" morria sem mensagem — duas vezes, em 10/09/2026, até a
 * causa aparecer. Quem precisa de data não precisa de navegador.
 */

/**
 * "YYYY-MM-DD" → "DD/MM/AAAA". A conversão é TEXTUAL de propósito: o banco guarda a data
 * como texto justamente para não depender de fuso, e `new Date("2026-01-01")` seria lido
 * como meia-noite UTC — em Brasília (-03) voltaria para 31/12/2025 na impressão.
 */
export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Carimbo de criação (Date do banco) em horário de Brasília. */
export function dataHoraBr(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}
