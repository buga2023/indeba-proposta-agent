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
