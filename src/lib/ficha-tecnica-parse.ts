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
  nome?: string;
  titulo?: string;
  descricao?: string;
  composicao?: string;
  aplicacao?: string;
  modoDeUso?: string;
  beneficios?: string[];
  embalagens?: { tamanho: number; unidade: "L" | "kg" | "ml" | "un" }[];
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

// Terceiro candidato a benefícios: a lista mora no MEIO da ficha (Alvaclor 165 e afins —
// entre as precauções e a tabela de operação), fora das duas regiões clássicas. Varre o
// texto inteiro, mas cada tópico é fechado no primeiro ";" ou num ponto final seguido de
// palavra em CAIXA ALTA (o começo da tabela/próxima seção) — sem esse corte, o último
// tópico engoliria a tabela de dosagem inteira.
function beneficiosNoMeio(texto: string): string[] | undefined {
  const itens = texto
    .split(/(?:^|\s)[-–—•●]\s+/)
    .slice(1)
    .map((t) => {
      let corte = t.length;
      const ponto = /;|\.(?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})|\.\s*$/.exec(t);
      if (ponto && ponto.index < corte) corte = ponto.index;
      for (const { re } of CABECALHOS) {
        const m = new RegExp(re.source, "i").exec(t);
        if (m && m.index < corte) corte = m.index;
      }
      return limpar(t.slice(0, corte));
    })
    // Além do tamanho, descarta o falso tópico que o hífen de "APLICAÇÃO - USO
    // PROFISSIONAL:" cria — item de verdade não abre com rótulo em dois pontos.
    .filter((t) => t.length > 12 && t.length < 240 && !/^[^:]{0,25}:/.test(t));
  return itens.length >= 2 ? itens.slice(0, 12) : undefined;
}

// Palavras de CATEGORIA: quando o que está colado no REV é só isso ("DETERGENTE
// DESENGRAXANTE"), é o título impresso, não o nome comercial do produto.
const CATEGORIA_RE = /^(DETERGENTE|ALVEJANTE|DESINFETANTE|DESENGRAXANTE|DESINCRUSTANTE|NEUTRALIZADOR|SABONETE|AMACIANTE|LIMPADOR|ADITIVO|REMOVEDOR)\b/;

// Nome comercial e categoria, da arte da ficha — sempre colados no marcador de revisão:
// "ALVACLOR 165   ALVEJANTE  REV:004/19", "CANDALL PT  REV.: 016/22", "REV.: 020/21
// PRIMMAX PLUS". Só existe no texto CRU (os espaços múltiplos separam as colunas da
// arte) — por isso roda antes da normalização. Sem o marcador, não arrisca palpite.
// Pedaços que aparecem colados no REV mas são SEÇÃO/rodapé da ficha, nunca nome de
// produto. Comparação sem acento (o extrator de PDF às vezes os perde).
const NAO_E_NOME =
  /(INFORMAC|TECNIC|QUIMICO|RESPONS|CONSERVAC|EMBALAGEM|MODO DE USO|ESPECIFICA|COMPOSIC|APLICAC|VALIDADE|MESES|BALDES|CAIXAS|BOMBONAS|GALOES|FRASCOS|PRAZO|PRECAUC|USO (INSTITUCIONAL|PROFISSIONAL)|CUIDADOS)/;

function nomeECategoria(textoCru: string): { nome?: string; titulo?: string } {
  const cap = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const valida = (p: string) => p.length >= 3 && !/^\d/.test(p) && !NAO_E_NOME.test(semAcento(p).toUpperCase());
  const antes = /([A-ZÀ-Ü0-9][A-ZÀ-Ü0-9 ]{2,60})\s{2,}REV\s*[.:]{1,2}\s*\d/.exec(textoCru);
  const depois = /REV\s*[.:]{1,2}\s*\d+\/\d+\s{2,}([A-ZÀ-Ü0-9][A-ZÀ-Ü0-9 ]{2,60})/.exec(textoCru);
  // Avalia os dois lados do REV: vale o primeiro que tiver um nome VÁLIDO (o outro lado
  // costuma ser rodapé — "QUÍMICO RESPONSÁVEL", prazo de validade, contagem de caixas).
  for (const m of [antes, depois]) {
    // "O PRATT ULTRA" — artigo herdado da frase da embalagem, não faz parte do nome.
    const partes = (m?.[1] ?? "").trim().split(/\s{2,}/).map((p) => p.trim().replace(/^O /, "")).filter(valida);
    if (!partes.length) continue;
    // Duas colunas: nome + categoria — e às vezes na ordem inversa (a arte imprime a
    // categoria acima do nome): a coluna que casa com palavra de categoria é o título.
    if (partes.length >= 2) {
      const [a, b] = [partes[0], partes[partes.length - 1]];
      return CATEGORIA_RE.test(a) && !CATEGORIA_RE.test(b)
        ? { nome: cap(b), titulo: cap(a) }
        : { nome: cap(a), titulo: cap(b) };
    }
    return CATEGORIA_RE.test(partes[0]) ? { titulo: cap(partes[0]) } : { nome: cap(partes[0]) };
  }
  return {};
}

// Tamanhos do bloco EMBALAGEM ("baldes plásticos lacrados contendo 20 kg", "bombonas de
// 5 e 20 litros"): só números com unidade reconhecida — nada é deduzido.
function embalagensDaFicha(blocoEmbalagem: string): CamposDaFicha["embalagens"] {
  const mapa: Record<string, "L" | "kg" | "ml" | "un"> = { l: "L", litro: "L", litros: "L", kg: "kg", quilo: "kg", quilos: "kg", ml: "ml" };
  const saida: NonNullable<CamposDaFicha["embalagens"]> = [];
  for (const m of blocoEmbalagem.matchAll(/(\d+(?:[.,]\d+)?)\s*(litros?|quilos?|kg|ml|L)\b/gi)) {
    const unidade = mapa[m[2].toLowerCase()];
    const tamanho = Number(m[1].replace(",", "."));
    if (!unidade || !Number.isFinite(tamanho) || tamanho <= 0) continue;
    if (!saida.some((e) => e.tamanho === tamanho && e.unidade === unidade)) saida.push({ tamanho, unidade });
  }
  return saida.length ? saida : undefined;
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
  // Nome/categoria dependem dos espaços múltiplos (colunas da arte) — extraídos ANTES da
  // normalização que colapsa tudo em espaço simples.
  const identidade = nomeECategoria(texto);
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
    ...identidade,
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
  const bens = candidatos.sort((a, b) => b.length - a.length)[0] ?? beneficiosNoMeio(t);
  if (bens) campos.beneficios = bens;
  // Embalagens: só do bloco EMBALAGEM (procurar unidade no texto todo pescaria dosagem).
  const emb = /EMBALAGEM\s*:?/i.exec(t);
  if (emb) {
    const bloco = t.slice(emb.index + emb[0].length, ms.find((m) => m.inicio > emb.index)?.inicio ?? t.length);
    const tamanhos = embalagensDaFicha(bloco);
    if (tamanhos) campos.embalagens = tamanhos;
  }
  return campos;
}
