// Concatena classes condicionais (versão mínima de clsx — sem deps).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Como o autor aparece na tela (áudio do Mateus, 31/08/2026: "o nome do pessoal que
 * lançou, não o e-mail"). O `autor` gravado continua sendo o e-mail — chave estável da
 * sessão —; `autorNome` é resolvido na leitura contra o cadastro e cai no e-mail quando
 * a conta não existe mais. Puro de propósito: roda em client component.
 */
export function autorLabel(registro: { autorNome?: string | null; autor: string }): string {
  return registro.autorNome?.trim() || registro.autor;
}
