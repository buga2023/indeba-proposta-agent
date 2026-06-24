// Sanitiza entrada NÃO-CONFIÁVEL (pergunta do usuário, texto de arquivo anexado) antes
// de interpolar num prompt do Ollama. Remove aspas e crases (delimitadores comuns usados
// para "fechar" o campo e injetar instruções), neutraliza quebras de linha e limita o
// tamanho. É defesa em profundidade: o backbone determinístico (§2) já garante que dado
// crítico (preço/contato/número) NUNCA vem do modelo — aqui só reduzimos a superfície de
// prompt injection no texto livre.
export function sanitizarEntrada(s: string, max = 500): string {
  return s
    .replace(/["`]/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
