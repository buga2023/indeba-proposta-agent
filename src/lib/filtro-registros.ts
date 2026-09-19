/**
 * Filtro das listas de registros das Ferramentas (áudio do Mateus com o João, 19/09/2026).
 *
 * João: "seria interessante ser mais preciso em uma visita específica… dividir por qual
 * cliente seria e em que período foi… tem que ter o filtro pelo cliente e pelo dia…
 * disponibilizar vários filtros que vão se juntando."
 *
 * "Que vão se juntando" é o contrato desta função: os campos combinam em E, não em OU —
 * cliente + período juntos respondem "a visita do dia X no cliente Y", que é a pergunta
 * que eles fazem na prática. Um OU devolveria a carteira inteira e não serviria pra nada.
 *
 * Mateus fechou o escopo na mesma conversa: "já pode iniciar com período, cliente" — só
 * esses dois. Em Contratos ele tirou o período ("aqui não precisa de período, no caso"),
 * e lá a tela chama sem passar data.
 *
 * Fica em lib/ (e não no componente) porque é regra, não desenho de tela: a UI só liga os
 * campos nela.
 */

export type FiltroRegistros = {
  /** Texto do cliente/empresa. Casa por trecho, sem diferenciar maiúscula. */
  termo: string;
  /** Início do período, AAAA-MM-DD. Vazio = sem limite. */
  de: string;
  /** Fim do período, AAAA-MM-DD. Vazio = sem limite. Inclusivo. */
  ate: string;
};

export const FILTRO_VAZIO: FiltroRegistros = { termo: "", de: "", ate: "" };

export function filtroAtivo(f: FiltroRegistros): boolean {
  return f.termo.trim() !== "" || f.de !== "" || f.ate !== "";
}

/**
 * Datas entram em ISO (AAAA-MM-DD), que ordena igual a texto — comparar string evita
 * construir Date e cair no fuso (new Date("2026-09-19") é UTC e volta um dia no Brasil).
 *
 * `data` undefined/null = registro sem data (contrato). Só atrapalha se houver recorte de
 * período: aí ele sai, porque não dá para afirmar que cai na janela.
 */
export function passaNoFiltro(f: FiltroRegistros, texto: string, data?: string | null): boolean {
  const termo = f.termo.trim().toLowerCase();
  if (termo && !texto.toLowerCase().includes(termo)) return false;
  if ((f.de || f.ate) && !data) return false;
  if (f.de && data && data < f.de) return false;
  if (f.ate && data && data > f.ate) return false;
  return true;
}

/** Rótulo da contagem: "N de M" enquanto filtra, o total puro quando não há filtro. */
export function contagem(filtrados: number, total: number, filtro: FiltroRegistros): string {
  return filtroAtivo(filtro) ? `${filtrados} de ${total}` : `${total}`;
}
