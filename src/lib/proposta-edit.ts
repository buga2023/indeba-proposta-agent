import type { PropostaScope } from "./contracts";

// Converte entrada humana ("150", "150,90") em decimal string canônica "\d+\.\d{2}".
// Preço nunca é float no domínio — sempre string (constituição §1.1).
export function normalizarPreco(v: string): string {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

// Retorna um novo scope com o preço da embalagem [idx] do item [codigo] alterado.
// Imutável: não muta o scope recebido (React state).
export function setPrecoEmbalagem(scope: PropostaScope, codigo: string, idx: number, valor: string): PropostaScope {
  return {
    ...scope,
    itens: scope.itens.map((it) =>
      it.codigo !== codigo
        ? it
        : { ...it, embalagens: it.embalagens.map((e, i) => (i === idx ? { ...e, preco: normalizarPreco(valor) } : e)) },
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
export function setQuantidadeAbsoluta(scope: PropostaScope, codigo: string, qtd: number): PropostaScope {
  const q = Math.max(1, Math.round(qtd));
  return { ...scope, itens: scope.itens.map((it) => (it.codigo === codigo ? { ...it, quantidade: q } : it)) };
}

export function setCondicaoComercial(
  scope: PropostaScope,
  campo: "validade" | "prazoEntrega" | "pagamento" | "frete",
  valor: string,
): PropostaScope {
  return { ...scope, condicoesComerciais: { ...scope.condicoesComerciais, [campo]: valor } };
}
