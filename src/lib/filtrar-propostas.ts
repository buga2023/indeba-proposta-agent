/**
 * Filtro da tela "Propostas feitas": termo (cliente/consultor) + período + status.
 * Regra pura; a tela só renderiza. A data usada é a mesma exibida na linha (atualizadoEm).
 */
export type PeriodoFiltro = "todos" | "mes" | "30d" | "ano";

export type FiltroPropostas = {
  termo: string;
  periodo: PeriodoFiltro;
  status: string; // "todos" ou o status exato
};

export const FILTRO_VAZIO: FiltroPropostas = { termo: "", periodo: "todos", status: "todos" };

type Filtravel = { cliente: string; autor: string; autorNome?: string | null; status: string; atualizadoEm: string };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

export function filtrarPropostas<T extends Filtravel>(lista: T[], f: FiltroPropostas, agora: Date = new Date()): T[] {
  const termo = norm(f.termo);
  let desde: number | null = null;
  if (f.periodo === "mes") desde = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
  else if (f.periodo === "ano") desde = new Date(agora.getFullYear(), 0, 1).getTime();
  else if (f.periodo === "30d") desde = agora.getTime() - 30 * 24 * 3600 * 1000;

  return lista.filter((p) => {
    if (f.status !== "todos" && p.status !== f.status) return false;
    if (termo && !norm(`${p.cliente} ${p.autorNome ?? ""} ${p.autor}`).includes(termo)) return false;
    if (desde !== null) {
      const t = new Date(p.atualizadoEm).getTime();
      if (Number.isNaN(t) || t < desde) return false;
    }
    return true;
  });
}

export function filtroAtivo(f: FiltroPropostas): boolean {
  return f.termo.trim() !== "" || f.periodo !== "todos" || f.status !== "todos";
}
