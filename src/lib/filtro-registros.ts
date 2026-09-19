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
  if (termo && !casaTexto(termo, texto)) return false;
  if ((f.de || f.ate) && !data) return false;
  if (f.de && data && data < f.de) return false;
  if (f.ate && data && data > f.ate) return false;
  return true;
}

/**
 * Casa por trecho e, quando o termo tem cara de número, tenta de novo só com os dígitos.
 *
 * É o que faz a busca por CNPJ funcionar (Mateus, 19/09/2026: procurar contrato por
 * "cliente ou CNPJ"): o cadastro guarda como o vendedor digitou — "12.345.678/0001-90" ou
 * "12345678000190" — e quem procura digita do outro jeito. Comparar só texto cru erraria
 * exatamente nesse caso, que é o motivo do pedido.
 *
 * O piso de 3 dígitos evita que digitar "1" varra a lista inteira por coincidência de
 * número dentro de qualquer razão social.
 */
function casaTexto(termo: string, texto: string): boolean {
  const alvo = texto.toLowerCase();
  if (alvo.includes(termo)) return true;
  const digitosTermo = termo.replace(/\D/g, "");
  if (digitosTermo.length < 3) return false;
  return alvo.replace(/\D/g, "").includes(digitosTermo);
}

/**
 * Junta os campos em que a busca olha. Usado onde há mais de um: o contrato casa por
 * cliente OU CNPJ, que é como o Mateus pediu ("cliente ou CNPJ") — um campo só de busca,
 * não dois.
 */
export function alvoBusca(...partes: (string | null | undefined)[]): string {
  return partes.filter((p) => p != null && p !== "").join(" ");
}

/** Rótulo da contagem: "N de M" enquanto filtra, o total puro quando não há filtro. */
export function contagem(filtrados: number, total: number, filtro: FiltroRegistros): string {
  return filtroAtivo(filtro) ? `${filtrados} de ${total}` : `${total}`;
}
