import { OrcamentoExtraido, type ItemOrcamento, type ItemRejeitado } from "../contracts";

/**
 * Orçamento anexado (texto já extraído do PDF/DOCX) → dados estruturados.
 *
 * SEM IA desde 24/08/2026 (pedido do Gustavo): a estruturação é um parser
 * determinístico de linhas — uma linha com texto E um valor em reais no fim é um
 * item; cabeçalho (Cliente/CNPJ/A\/C/Segmento) e rodapé (Pagamento/Frete/Validade/
 * Prazo) saem por rótulo. O que o parser não reconhece simplesmente não entra —
 * nada é inventado, e o vendedor confere tudo na tela antes de montar.
 *
 * A guarda de preço (precoConstaNoTexto) continua no fluxo: com o parser ela é
 * trivialmente verdadeira (o preço É recortado do texto), mas segue como
 * teste-guardião barato contra regressão do próprio parser.
 */

// Todos os números do texto, comparáveis por dígitos ("1.234,56" → "123456").
const soDigitos = (s: string) => s.replace(/\D/g, "");

// O preço consta no texto? Compara por dígitos com qualquer token numérico.
// Aceita também a forma sem centavos quando o preço é redondo ("130" ⇔ "130.00").
export function precoConstaNoTexto(texto: string, preco: string): boolean {
  const alvo = soDigitos(preco);
  const alvos = new Set([alvo]);
  if (preco.endsWith(".00")) alvos.add(soDigitos(preco.slice(0, -3)));
  const tokens = texto.match(/\d(?:[\d.,]*\d)?/g) ?? [];
  return tokens.some((t) => alvos.has(soDigitos(t)));
}

// Separa itens aprovados pela guarda de preço dos rejeitados (teste-guardião).
export function validarPrecos(
  texto: string,
  itens: ItemOrcamento[],
): { aceitos: ItemOrcamento[]; rejeitados: ItemRejeitado[] } {
  const aceitos: ItemOrcamento[] = [];
  const rejeitados: ItemRejeitado[] = [];
  for (const item of itens) {
    if (precoConstaNoTexto(texto, item.preco)) aceitos.push(item);
    else
      rejeitados.push({
        nome: item.nome,
        preco: item.preco,
        motivo: "Preço não consta no texto do orçamento — confira o documento e informe manualmente.",
      });
  }
  return { aceitos, rejeitados };
}

// Normaliza para casamento: minúsculas, sem acento, só alfanumérico. Apóstrofo é
// REMOVIDO (não vira espaço) — senão "Soft's" vira dois tokens "soft"+"s" e nunca casa
// com "Softs" (comum em texto de ERP/orçamento, que costuma vir sem apóstrofo).
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Casa o nome vindo do orçamento com um produto do catálogo (determinístico):
// todos os tokens do nome do catálogo presentes no nome do item (ou vice-versa).
// Empate → nome de catálogo mais longo (mais específico) vence. Sem casamento → null.
export function matchCatalogo<T extends { codigo: string; nome: string }>(
  nomeItem: string,
  produtos: readonly T[],
): T | null {
  const alvo = norm(nomeItem);
  if (!alvo) return null;
  const tokensAlvo = new Set(alvo.split(" "));
  let melhor: T | null = null;
  let melhorLen = 0;
  for (const p of produtos) {
    const n = norm(p.nome);
    if (!n) continue;
    const tokens = n.split(" ");
    const contem = tokens.every((t) => tokensAlvo.has(t)) || [...tokensAlvo].every((t) => tokens.includes(t));
    if (contem && n.length > melhorLen) {
      melhor = p;
      melhorLen = n.length;
    }
  }
  return melhor;
}

/* ───────────────────── parser determinístico (sem IA) ───────────────────── */

// Valor monetário no fim da linha: "R$ 1.234,56", "1234,56", "99". É ele que diz
// que a linha é um item — linha sem preço no fim não é item.
const PRECO_FIM = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*$/;

// "1.234,56" | "1234.56" | "99" → "1234.56" (convenção do projeto: decimal com ponto,
// 2 casas). Vírgula presente = formato brasileiro (ponto é milhar); só ponto com 2
// casas = já decimal; inteiro = ",00".
export function normalizarPreco(bruto: string): string | null {
  const s = bruto.trim();
  let n: number;
  if (s.includes(",")) n = Number(s.replace(/\./g, "").replace(",", "."));
  else if (/^\d+\.\d{1,2}$/.test(s)) n = Number(s);
  else if (/^\d+$/.test(s)) n = Number(s);
  else return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

// Valor de um campo rotulado ("Cliente: …", "Frete: CIF"). O valor termina onde o
// layout de coluna separa (2+ espaços) ou onde começa outro rótulo na mesma linha.
function campo(texto: string, rotulo: RegExp): string | null {
  const m = texto.match(rotulo);
  if (!m?.[1]) return null;
  const v = m[1].split(/\s{2,}/)[0].trim().replace(/[.,;]$/, "");
  return v || null;
}

// Uma linha de item: "1. PRIMMAX PLUS - Bombona 5 L ..... 2 un ... R$ 130,00".
function parseItem(linha: string): ItemOrcamento | null {
  const precoM = linha.match(PRECO_FIM);
  if (!precoM) return null;
  const preco = normalizarPreco(precoM[1]);
  if (!preco) return null;

  // O que vem antes do preço; corta o preenchimento de coluna ("....", "…", tabs).
  let resto = linha.slice(0, precoM.index).replace(/(?:R\$)?\s*$/, "");
  resto = resto.replace(/[.…\-–—\s]+$/, "");

  // Quantidade: "2 un", "3 und", "2 x", "2 pç" — em qualquer ponto após o nome.
  let quantidade = 1;
  const qtdM = resto.match(/(\d+)\s*(?:un(?:d|id)?s?|x|p(?:ç|c)s?)\b\.?/i);
  if (qtdM) {
    quantidade = Math.max(1, parseInt(qtdM[1], 10));
    resto = (resto.slice(0, qtdM.index) + resto.slice(qtdM.index! + qtdM[0].length)).replace(/[.…\s]+$/, "");
  }

  // Embalagem: "5 L", "20L", "1,5 kg", "500 ml" — a ÚLTIMA menção antes do preço
  // (nomes como "Bombona 5 L" ficam no nome; o par tamanho/unidade é estruturado à parte).
  let tamanho: number | null = null;
  let unidade: ItemOrcamento["unidade"] = null;
  const embalagens = [...resto.matchAll(/(\d+(?:[.,]\d+)?)\s*(L|lt|litros?|kg|quilos?|ml)\b\.?/gi)];
  const emb = embalagens[embalagens.length - 1];
  if (emb) {
    tamanho = Number(emb[1].replace(",", "."));
    const u = emb[2].toLowerCase();
    unidade = u === "kg" || u.startsWith("quilo") ? "kg" : u === "ml" ? "ml" : "L";
    if (!Number.isFinite(tamanho) || tamanho <= 0) tamanho = null;
    if (tamanho === null) unidade = null;
  }

  // Nome: o texto até o preenchimento de coluna, sem a numeração da lista
  // ("1.", "02)", "-") e sem código de ERP puramente numérico no início.
  const nome = resto
    .split(/\s*\.{3,}\s*|\s*…\s*|\t+/)[0]
    .replace(/^\s*\d{1,3}\s*[.)]\s*/, "")
    .replace(/^[-–—•*\s]+/, "")
    .trim();
  if (!nome || !/[a-zA-ZÀ-ÿ]{2}/.test(nome)) return null;

  return { nome, quantidade, tamanho, unidade, preco, codigoCatalogo: null, nomeCatalogo: null };
}

// texto do orçamento → estrutura validada + itens rejeitados pela guarda.
// Parser determinístico: nada de IA — só entra o que está literalmente no texto.
// `async` preservado: a rota e os testes já consomem como promise, e um dia o
// parser pode voltar a ter etapa assíncrona sem mudar os chamadores.
export async function estruturarOrcamento(
  texto: string,
): Promise<{ extraido: OrcamentoExtraido; rejeitados: ItemRejeitado[] }> {
  const linhas = texto.split(/\r?\n/);

  // Linhas de rótulo (cabeçalho/rodapé) não são itens mesmo que terminem em número.
  const ROTULO = /^\s*(cliente|cnpj|segmento|a\/c|aos cuidados|respons[áa]vel|pagamento|frete|validade|prazo|total|subtotal|or[çc]amento)\b/i;
  const itens: ItemOrcamento[] = [];
  for (const linha of linhas) {
    if (ROTULO.test(linha)) continue;
    const item = parseItem(linha);
    if (item) itens.push(item);
  }
  if (itens.length === 0) {
    throw new Error(
      "Não consegui extrair itens deste orçamento — o arquivo precisa ter uma linha por produto com o preço no fim (ex.: \"PRIMMAX 5 L … 2 un … R$ 130,00\"). Confira o PDF ou monte pela Proposta de Solução.",
    );
  }

  const cnpjM = texto.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  const extraido = OrcamentoExtraido.parse({
    cliente: {
      razaoSocial: campo(texto, /cliente\s*[:\-]\s*(.+)/i),
      cnpj: cnpjM?.[1] ?? null,
      segmento: campo(texto, /segmento\s*[:\-]\s*(.+)/i),
      responsavel: campo(texto, /(?:a\/c|aos cuidados(?: de)?|respons[áa]vel)\s*[:\-.]?\s*(.+)/i),
    },
    itens,
    condicoes: {
      validade: campo(texto, /validade(?: da proposta)?\s*[:\-]\s*(.+)/i),
      prazoEntrega: campo(texto, /prazo(?: de)? entrega\s*[:\-]\s*(.+)/i),
      pagamento: campo(texto, /(?:condi[çc][õo]es de )?pagamento\s*[:\-]\s*(.+)/i),
      frete: campo(texto, /frete\s*[:\-]\s*(.+)/i),
    },
  });
  const { aceitos, rejeitados } = validarPrecos(texto, extraido.itens);
  return { extraido: { ...extraido, itens: aceitos }, rejeitados };
}
