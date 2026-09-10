"use client";

/**
 * "Extrair PDF" — o botão que o Mateus pediu no áudio de 10/09/2026: "em todos os
 * registros você liberar a opção pra gente de extrair isso aí como PDF pra mandar pro
 * cliente… o cliente pode falar 'cadê o relatório da última visita?'".
 *
 * É um <a target="_blank">, não um fetch: a rota devolve o PDF com `Content-Disposition:
 * inline`, então o navegador abre no visualizador dele — de onde a pessoa salva ou manda
 * pelo WhatsApp. Um fetch + blob daria o mesmo arquivo com mais código e sem pré-visualizar.
 *
 * Fica ao lado de Editar/Excluir nos cards de Visita de Rotina, Nova Prospecção e
 * Solicitação Comercial. Estoque de Comodatos e Contratos ficam de fora (recorte do
 * Gustavo, 10/09/2026): estoque já exporta Excel/CSV e o contrato já tem "Abrir contrato
 * (PDF)", que serve a cópia assinada.
 */
export function BotaoPdf({ href, titulo }: { href: string; titulo: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={titulo}
      style={{
        padding: "5px 11px",
        borderRadius: "999px",
        border: "1px solid var(--gray-300)",
        background: "white",
        color: "var(--gray-700)",
        fontSize: "12px",
        fontWeight: 600,
        textDecoration: "none",
        cursor: "pointer",
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v8M5 7l3 3 3-3" />
        <path d="M2.5 11.5v1a1.5 1.5 0 001.5 1.5h8a1.5 1.5 0 001.5-1.5v-1" />
      </svg>
      PDF
    </a>
  );
}
