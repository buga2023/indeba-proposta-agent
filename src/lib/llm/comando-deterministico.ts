// Interpretador DETERMINÍSTICO do chat de correção — roda ANTES da IA (Ollama).
// Motivo (QA 10/08/2026): com o Ollama fora do ar, o chat respondia "não entendi"
// até para o exemplo do próprio placeholder ("muda a quantidade do Candall RF pra 3"),
// enquanto o "não deixar passar de R$X" — determinístico — seguia funcionando. Os
// comandos frequentes (quantidade, preço, remover, adicionar, teto) têm forma fixa
// o bastante para regex + casamento de nome/SKU; a IA fica para o resto (dados do
// cliente, condições, seleção por necessidade), onde a linguagem varia de verdade.
import type { ComandoEdicao } from "../contracts";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

type Ref = { codigo: string; nome: string };

// Resolve o produto citado na mensagem: nome completo, SKU, ou o nome "menos o
// sufixo" (o vendedor fala "Candall RF"; o catálogo pode ter "Candall RF 5L").
// Empate resolve pelo casamento mais LONGO — "Primmax Plus" ganha de "Primmax".
function acharItem(msg: string, itens: Ref[]): Ref | null {
  const m = norm(msg);
  let melhor: Ref | null = null;
  let melhorLen = 0;
  for (const it of itens) {
    const candidatos = [norm(it.nome), norm(it.codigo)];
    // Prefixos do nome com 2+ palavras ("candall rf" de "candall rf 5l"): o nome
    // inteiro pode não estar na mensagem, mas o começo identificador sim.
    const palavras = norm(it.nome).split(/\s+/);
    for (let n = palavras.length - 1; n >= 2; n--) candidatos.push(palavras.slice(0, n).join(" "));
    for (const c of candidatos) {
      if (c.length >= 4 && c.length > melhorLen && m.includes(c)) {
        melhor = it;
        melhorLen = c.length;
      }
    }
  }
  return melhor;
}

const cmd = (acao: ComandoEdicao["acao"], codigoItem: string | null = null): ComandoEdicao => ({
  acao,
  valorTexto: null,
  codigoItem,
  campoCondicao: null,
});

// null = "não tenho certeza; deixa pra IA". Nunca chuta: só devolve comando quando
// o verbo E o alvo casam sem ambiguidade.
export function interpretarDeterministico(
  mensagem: string,
  itensProposta: Ref[],
  itensCatalogo: Ref[],
): ComandoEdicao | null {
  const m = norm(mensagem);
  const temNumero = /\d/.test(m);

  // Teto de orçamento — antes de preço, porque "valor" aparece nos dois.
  if (/(nao\s+(deixa?r?|deixe)\s+passar|teto|no maximo|limite)\b/.test(m) && temNumero) {
    return cmd("limitar_orcamento");
  }

  const naProposta = acharItem(m, itensProposta);

  if (/\b(quantidade|qtd|unidades?)\b/.test(m) && naProposta && temNumero) {
    return cmd("alterar_quantidade_item", naProposta.codigo);
  }
  if (/\b(preco|valor)\b/.test(m) && naProposta && temNumero) {
    return cmd("alterar_preco_item", naProposta.codigo);
  }
  if (/\b(remove[rm]?|tira[r]?|exclui[r]?|apaga[r]?)\b/.test(m) && naProposta) {
    return cmd("remover_item", naProposta.codigo);
  }
  if (/\b(adiciona[r]?|inclui[r]?|coloca[r]?|acrescenta[r]?|bota[r]?)\b/.test(m)) {
    // Só produto do CATÁLOGO que ainda não está na proposta — se o citado já está
    // nela, o pedido é ambíguo (aumentar quantidade?) e a IA decide.
    const doCatalogo = acharItem(m, itensCatalogo);
    if (doCatalogo && !itensProposta.some((i) => i.codigo === doCatalogo.codigo)) {
      return cmd("adicionar_item_catalogo", doCatalogo.codigo);
    }
  }
  return null;
}
