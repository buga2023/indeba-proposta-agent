import type { PropostaScope } from "./contracts";

// Converte entrada humana em decimal string canônica "\d+\.\d{2}".
// Preço nunca é float no domínio — sempre string (constituição §1.1).
//
// Com VÍRGULA → é decimal pt-BR: o ponto é separador de milhar ("1.234,56" → 1234.56).
// SEM vírgula → o ponto (se houver) é o separador DECIMAL e é preservado ("150.90" → 150.90).
// Antes o ponto era sempre removido: o input de preço da revisão vem de `toFixed(2)` (ex.
// "150.90"), e só tabular pelo campo dispara o onBlur — "150.90" virava 15090.00 (100×),
// dinheiro errado direto no PDF/contrato. O caso pt-BR com vírgula continua idêntico.
export function normalizarPreco(v: string): string {
  const s = String(v).trim();
  const normalizado = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

// O MESMO produto pode aparecer mais de uma vez na proposta em embalagens diferentes
// (Primmax DT 5 L e 20 L como itens separados) — então o código NÃO identifica um item:
// quem identifica é a POSIÇÃO em scope.itens. Os setters abaixo trabalham por posição;
// `posicaoDoCodigo` resolve o caminho do chat de correção, que só sabe o código (age no
// primeiro item daquele produto).
export const posicaoDoCodigo = (scope: PropostaScope, codigo: string): number =>
  scope.itens.findIndex((it) => it.codigo === codigo);

// Retorna um novo scope com o preço da embalagem [idx] do item na posição [pos] alterado.
// Imutável: não muta o scope recebido (React state).
export function setPrecoEmbalagem(scope: PropostaScope, pos: number, idx: number, valor: string): PropostaScope {
  return {
    ...scope,
    itens: scope.itens.map((it, i) =>
      i !== pos
        ? it
        : { ...it, embalagens: it.embalagens.map((e, j) => (j === idx ? { ...e, preco: normalizarPreco(valor) } : e)) },
    ),
  };
}

// Extrai o PRIMEIRO número de uma mensagem digitada por humano (ex.: "muda o preço
// pra R$ 25,90" → "25,90"; "quero 5 unidades" → "5"). Usado pelo chat de correção:
// a IA nunca decide o valor final — só a mensagem original do vendedor pode.
// Não entende separador de milhar ("25.000,00"); suficiente para os valores deste catálogo.
export function extrairNumero(texto: string): string | null {
  const m = texto.match(/(?:R\$\s*)?(\d+(?:[.,]\d+)?)/);
  return m ? m[1] : null;
}

// Campos de cliente editáveis pelo chat de correção — nunca preço/quantidade.
export function setClienteCampo(
  scope: PropostaScope,
  campo: "razaoSocial" | "cnpj" | "segmento" | "responsavel",
  valor: string,
): PropostaScope {
  return { ...scope, cliente: { ...scope.cliente, [campo]: valor } };
}

// Quantidade ABSOLUTA (não delta) — mínimo 1, nunca vira 0/negativo por engano de parse.
export function setQuantidadeAbsoluta(scope: PropostaScope, pos: number, qtd: number): PropostaScope {
  const q = Math.max(1, Math.round(qtd));
  return { ...scope, itens: scope.itens.map((it, i) => (i === pos ? { ...it, quantidade: q } : it)) };
}

// Chat "limitar_orcamento": corta, do item de menor preço unitário pro maior, até o total
// caber no teto — nunca esvazia a proposta (para com 1 item restante). "Menos importante" não
// tem julgamento pra IA fazer aqui: preço unitário é o único critério objetivo disponível.
export function cortarParaOrcamento(
  itens: { pos: number; precoUnit: number; quantidade: number }[],
  total: number,
  teto: number,
): { posicoesRemover: number[]; totalFinal: number } {
  const ordenados = [...itens].sort((a, b) => a.precoUnit - b.precoUnit);
  const posicoesRemover: number[] = [];
  let totalFinal = total;
  for (const it of ordenados) {
    if (totalFinal <= teto || itens.length - posicoesRemover.length <= 1) break;
    posicoesRemover.push(it.pos);
    totalFinal -= it.precoUnit * it.quantidade;
  }
  return { posicoesRemover, totalFinal };
}

export function setCondicaoComercial(
  scope: PropostaScope,
  campo: "validade" | "prazoEntrega" | "pagamento" | "frete",
  valor: string,
): PropostaScope {
  return { ...scope, condicoesComerciais: { ...scope.condicoesComerciais, [campo]: valor } };
}

// Edita o TEXTO de um item de "Condições Comerciais" do modelo Proposta Consolidada
// (scope.consolidada.condicoes.itens[i].texto) — é esse campo que o PDF final
// realmente renderiza (o modelo "consolidada" é o único selecionável hoje;
// setCondicaoComercial acima alimenta os outros modelos, hoje sem uso). Título/ícone
// ficam fixos: só o conteúdo do item é editável.
export function setCondicaoConsolidadaTexto(scope: PropostaScope, index: number, texto: string): PropostaScope {
  if (!scope.consolidada) return scope;
  return {
    ...scope,
    consolidada: {
      ...scope.consolidada,
      condicoes: {
        ...scope.consolidada.condicoes,
        itens: scope.consolidada.condicoes.itens.map((it, i) => (i === index ? { ...it, texto } : it)),
      },
    },
  };
}

// Mesma edição de cima, mas pelo "campo" clássico (validade/prazoEntrega/pagamento/
// frete) que o chat de correção já classifica (comando.campoCondicao) — casa
// deterministicamente pelo ícone do item padrão (consolidada-defaults.ts), nunca por
// posição ou heurística de texto. Sem o item correspondente, não faz nada (nunca
// inventa/adiciona item novo).
const ICONE_POR_CAMPO_CONDICAO = { validade: "validade", prazoEntrega: "prazo", pagamento: "pagamento", frete: "frete" } as const;
export function setCondicaoConsolidadaPorCampo(
  scope: PropostaScope,
  campo: "validade" | "prazoEntrega" | "pagamento" | "frete",
  texto: string,
): PropostaScope {
  if (!scope.consolidada) return scope;
  const icone = ICONE_POR_CAMPO_CONDICAO[campo];
  const index = scope.consolidada.condicoes.itens.findIndex((it) => it.icone === icone);
  return index === -1 ? scope : setCondicaoConsolidadaTexto(scope, index, texto);
}
