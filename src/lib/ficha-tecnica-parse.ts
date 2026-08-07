// Lê a FICHA TÉCNICA em PDF e devolve os campos do cadastro já separados.
//
// Nasce de um pedido do Matheus (06/08/2026): "pegar a ficha técnica e botar qual o título,
// o subtítulo, os benefícios, tudo na ordem… para o cara só copiar e colar". Copiar e colar
// oito blocos de um PDF, produto a produto, é trabalho que a máquina faz melhor.
//
// DETERMINÍSTICO de propósito — nada de IA aqui. As fichas da Indeba seguem um formato só,
// com cabeçalhos em caixa alta (COMPOSIÇÃO:, APLICAÇÃO - USO PROFISSIONAL:, MODO DE USO:,
// ESPECIFICAÇÕES FÍSICO-QUÍMICAS:), e recortar por eles devolve o texto REAL do documento.
// Um modelo, além de indisponível em produção na maior parte do tempo, poderia reescrever
// composição química — exatamente o tipo de dado que a constituição §1 proíbe inventar.
//
// O resultado é uma SUGESTÃO: quem confirma é o gestor, no formulário, antes de salvar.

export type CamposDaFicha = {
  descricao?: string;
  composicao?: string;
  aplicacao?: string;
  modoDeUso?: string;
  beneficios?: string[];
  caracteristicas?: { pH?: string; aspecto?: string; cor?: string; odor?: string; densidade?: string; cloroAtivo?: string };
};

// Cabeçalhos que fecham uma seção. A lista existe para o corte, não para a leitura: qualquer
// um deles encerra o bloco anterior, mesmo os que não viram campo (precauções, validade).
const CABECALHOS: { chave: keyof CamposDaFicha | "fim"; re: RegExp }[] = [
  { chave: "composicao", re: /COMPOSI[ÇC][ÃA]O\s*:?/i },
  { chave: "aplicacao", re: /APLICA[ÇC][ÃA]O(?:\s*[-–—]\s*USO\s+PROFISSIONAL)?\s*:?/i },
  { chave: "modoDeUso", re: /MODO\s+DE\s+USO\s*:?/i },
  { chave: "fim", re: /INFORMA[ÇC][ÕO]ES\s+T[ÉE]CNICAS\s*:?/i },
  { chave: "fim", re: /ESPECIFICA[ÇC][ÕO]ES\s+F[ÍI]SICO[-\s]QU[ÍI]MICAS\s*:?/i },
  { chave: "fim", re: /EMBALAGEM\s*:?/i },
  { chave: "fim", re: /CUIDADOS\s+DE\s+CONSERVA[ÇC][ÃA]O\s*:?/i },
  { chave: "fim", re: /PRECAU[ÇC][ÕO]ES\s+DE\s+USO\s*:?/i },
  { chave: "fim", re: /ABERTURA\s+DA\s+EMBALAGEM\s*:?/i },
  { chave: "fim", re: /PRAZO\s+DE\s+VALIDADE\s*:?/i },
  { chave: "fim", re: /QU[ÍI]MICO\s+RESPONS[ÁA]VEL\s*:?/i },
  { chave: "fim", re: /CONSULTE\s+NOSSO/i },
  { chave: "fim", re: /PRODUTO\s+SANEANTE/i },
];

type Marca = { chave: keyof CamposDaFicha | "fim"; inicio: number; fim: number };

function marcas(texto: string): Marca[] {
  const achadas: Marca[] = [];
  for (const { chave, re } of CABECALHOS) {
    // `g` recriado aqui de propósito: RegExp com estado (lastIndex) compartilhado entre
    // chamadas pula ocorrências de forma imprevisível.
    const global = new RegExp(re.source, "gi");
    for (const m of texto.matchAll(global)) {
      if (m.index === undefined) continue;
      achadas.push({ chave, inicio: m.index, fim: m.index + m[0].length });
    }
  }
  return achadas.sort((a, b) => a.inicio - b.inicio);
}

// Limpa o que a extração de PDF deixa para trás: pontilhados de preenchimento, espaços
// dobrados e a pontuação solta que sobra na borda de um corte.
function limpar(s: string): string {
  return s
    .replace(/\.{3,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.\-–—]+/, "")
    .replace(/[\s;,\-–—]+$/, "")
    .trim();
}

// Aspecto........Pó  Cor.......Branca  →  { aspecto: "Pó", cor: "Branca" }
// O valor termina onde começa o próximo rótulo conhecido — no PDF tudo isso vira uma linha só.
function caracteristicas(texto: string): CamposDaFicha["caracteristicas"] {
  type Chave = keyof NonNullable<CamposDaFicha["caracteristicas"]>;
  // Os seis primeiros viram campo; os demais entram só para FECHAR o valor do anterior — a
  // extração devolve a tabela como linha corrida, e sem eles a densidade do Autocar saía
  // com "…Viscosidade (30 C) 31" + 4" Teor de espuma (" grudado no valor.
  const ROTULOS: [Chave | "corte", RegExp][] = [
    ["aspecto", /ASPECTO/i],
    ["cor", /\bCOR\b/i],
    ["odor", /ODOR/i],
    ["pH", /\bpH\b(?:\s*(?:\([^)]*\)|sol\.?\s*aq\.?\s*[\d,.%]*))?/i],
    ["densidade", /DENSIDADE(?:\s*\([^)]*\))?/i],
    ["cloroAtivo", /CLORO\s+ATIVO/i],
    ["corte", /VISCOSIDADE(?:\s*\([^)]*\))?/i],
    ["corte", /TEOR\s+DE\s+ESPUMA/i],
    ["corte", /SOLUBILIDADE/i],
    ["corte", /PONTO\s+DE\s+FULGOR/i],
    ["corte", /INFLAMABILIDADE/i],
    ["corte", /ALCALINIDADE/i],
    ["corte", /MAT[ÉE]RIA\s+ATIVA/i],
  ];
  const pontos: { chave: Chave | "corte"; inicio: number; fim: number }[] = [];
  for (const [chave, re] of ROTULOS) {
    const m = new RegExp(re.source, "i").exec(texto);
    if (m?.index !== undefined) pontos.push({ chave, inicio: m.index, fim: m.index + m[0].length });
  }
  pontos.sort((a, b) => a.inicio - b.inicio);
  const saida: Record<string, string> = {};
  pontos.forEach((p, i) => {
    if (p.chave === "corte") return;
    const ate = pontos[i + 1]?.inicio ?? texto.length;
    // Corta em 40 para não engolir um parágrafo inteiro quando o rótulo aparece no meio de
    // uma frase corrida ("...cor branca e odor característico do produto, que...").
    const valor = limpar(texto.slice(p.fim, ate))
      .slice(0, 40)
      // Restos da tabela: unidade quebrada em dois pedaços pelo PDF ("(g/c )", "m³") e
      // letra solta no fim, que costuma ser o "o" de "(30 oC)".
      .replace(/\(\s*[a-zA-Z/³²]{0,4}\s*\)/g, "")
      .replace(/\s+[a-zA-Z³²]\s*$/, "")
      .trim();
    // pH e densidade são medidas: o valor começa no primeiro dígito (o que vem antes é
    // condição de ensaio — "a (1%)", "a 30°C") e termina se o rótulo se repetir na linha.
    const numerico =
      p.chave === "pH" || p.chave === "densidade"
        ? limpar(
            valor
              // "a ( 1% ) 6,50" — a condição de ensaio também tem dígito, então ela sai
              // pelo parêntese que a fecha, antes de o corte numérico entrar.
              .replace(/^[^)]{0,15}\)\s*/, "")
              .replace(/^[^0-9]*(?=[0-9])/, "")
              .split(/\b(?:pH|densidade)\b/i)[0],
          )
        : valor;
    if (numerico) saida[p.chave] = numerico;
  });
  return Object.keys(saida).length ? saida : undefined;
}

// Os benefícios vêm como lista de tópicos, cada um aberto por hífen ou bala — às vezes no
// rodapé, às vezes na abertura (é o caso do Candall PT). Por isso a busca é no texto todo.
function beneficios(texto: string): string[] | undefined {
  const itens = texto
    .split(/(?:^|\s)[-–—•●]\s+/)
    .slice(1)
    .map((t) => limpar(t))
    // Um tópico de benefício é uma frase; recortes de 3 letras são resíduo de tabela.
    .filter((t) => t.length > 12 && t.length < 240);
  return itens.length >= 2 ? itens.slice(0, 12) : undefined;
}

// Onde os tópicos começam — a descrição termina aí. Sem esse corte, um produto que abre a
// ficha com a lista de vantagens vira "descrição" de quatro linhas com hífens no meio.
function inicioDosTopicos(texto: string): number {
  const m = /(?:^|\s)[-–—•●]\s+\S/.exec(texto);
  return m?.index ?? -1;
}

/** Texto cru da ficha (já extraído do PDF) → campos do cadastro. Campo que a ficha não
 *  traz sai ausente: nada é preenchido por dedução. */
export function camposDaFicha(texto: string): CamposDaFicha {
  const t = texto.replace(/\s+/g, " ").trim();
  if (!t) return {};
  const ms = marcas(t);

  const secao = (chave: keyof CamposDaFicha): string | undefined => {
    const i = ms.findIndex((m) => m.chave === chave);
    if (i < 0) return undefined;
    const ate = ms[i + 1]?.inicio ?? t.length;
    const bruto = limpar(t.slice(ms[i].fim, ate));
    return bruto.length > 2 ? bruto : undefined;
  };

  // A descrição é o que vem ANTES do primeiro cabeçalho — nas fichas da Indeba é a frase que
  // define o produto ("Alvejante clorado, também indicado para oxidação de manchas…"). Se a
  // ficha abre pela lista de vantagens, ela para no primeiro tópico: aquilo é benefício.
  const antesDoPrimeiro = ms.length ? t.slice(0, ms[0].inicio) : t;
  const corte = inicioDosTopicos(antesDoPrimeiro);
  const abertura = limpar(corte >= 0 ? antesDoPrimeiro.slice(0, corte) : antesDoPrimeiro);
  const fisico = /ESPECIFICA[ÇC][ÕO]ES\s+F[ÍI]SICO[-\s]QU[ÍI]MICAS\s*:?/i.exec(t);
  // As características ficam entre "especificações físico-químicas" e o próximo cabeçalho;
  // sem esse bloco, procurar os rótulos no texto inteiro pescaria "cor" de qualquer frase.
  const blocoFisico = fisico?.index !== undefined
    ? t.slice(fisico.index + fisico[0].length, ms.find((m) => m.inicio > fisico.index!)?.inicio ?? t.length)
    : "";

  const campos: CamposDaFicha = {
    ...(abertura.length > 15 && abertura.length < 600 ? { descricao: abertura } : {}),
    ...(secao("composicao") ? { composicao: secao("composicao") } : {}),
    ...(secao("aplicacao") ? { aplicacao: secao("aplicacao") } : {}),
    ...(secao("modoDeUso") ? { modoDeUso: secao("modoDeUso") } : {}),
  };
  const carac = caracteristicas(blocoFisico);
  if (carac) campos.caracteristicas = carac;
  // Tópicos ficam ora na abertura, ora no rodapé (depois do último bloco com cabeçalho).
  // Vale a lista mais longa: uma seção de texto corrido às vezes tem um travessão isolado,
  // e a lista de verdade é sempre a maior.
  const candidatos = [
    beneficios(ms.length ? t.slice(ms[ms.length - 1].fim) : t),
    beneficios(antesDoPrimeiro),
  ].filter((x): x is string[] => !!x);
  const bens = candidatos.sort((a, b) => b.length - a.length)[0];
  if (bens) campos.beneficios = bens;
  return campos;
}
