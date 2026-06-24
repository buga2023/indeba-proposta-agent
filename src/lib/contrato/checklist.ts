/**
 * Checklist de análise de contrato — taxonomia da CUAD adaptada ao Brasil.
 *
 * Por que determinístico: o benchmark ContractEval mostrou que LLMs locais (como o Qwen)
 * são "preguiçosos" para ACHAR O QUE FALTA — dizem "nenhuma cláusula relacionada" mesmo
 * quando há. Então quem garante COBERTURA é o código: varremos o texto categoria por
 * categoria. O LLM, depois, só CLASSIFICA risco e EXPLICA (camada separada). §2/§6:
 * o que é "presente/ausente" e o trecho saem de regex, não do modelo; o humano decide.
 */

export type Severidade = "alta" | "media" | "baixa";

export type Categoria = {
  id: string;
  nome: string; // PT-BR
  oQueOlhar: string;
  padroes: RegExp[]; // detecção determinística (PT-BR)
  severidade: Severidade; // gravidade se AUSENTE (ou se presente com risco)
  fundamento: string | null; // âncora legal BR (validar via LexML)
};

// Subconjunto curado da CUAD (41 tipos) mapeado para contrato comercial BR. Onde a
// categoria da CUAD é específica de mercado US (ex.: ROFR/ROFO), foi omitida ou fundida.
export const CATEGORIAS: Categoria[] = [
  { id: "objeto", nome: "Objeto", oQueOlhar: "O que está sendo contratado, de forma determinada.", padroes: [/objeto\s+(do|deste)\s+contrato/i, /tem\s+por\s+objeto/i], severidade: "alta", fundamento: "CC art. 104 (objeto lícito e determinado)" },
  { id: "partes", nome: "Qualificação das partes", oQueOlhar: "Contratante e contratada com CNPJ/CPF e endereço.", padroes: [/contratante/i, /contratad[ao]/i, /\bCNPJ\b/i, /raz[ãa]o\s+social/i], severidade: "alta", fundamento: null },
  { id: "preco_pagamento", nome: "Preço e pagamento", oQueOlhar: "Valor, forma, prazo e vencimento.", padroes: [/pagamento/i, /vencimento/i, /\bfatura\b/i, /\bboleto\b/i, /valor\s+(total|do\s+contrato)/i], severidade: "alta", fundamento: null },
  { id: "vigencia", nome: "Vigência / prazo", oQueOlhar: "Início, duração e término.", padroes: [/vig[êe]ncia/i, /prazo\s+de\s+\d+\s+(dias|meses|anos)/i, /vigorar/i], severidade: "alta", fundamento: null },
  { id: "renovacao", nome: "Renovação automática", oQueOlhar: "Prorrogação automática e como evitá-la.", padroes: [/renova[çc][ãa]o\s+autom[áa]tica/i, /prorroga[çc][ãa]o/i, /renovad[oa]\s+automaticamente/i], severidade: "media", fundamento: null },
  { id: "rescisao", nome: "Rescisão / resilição", oQueOlhar: "Hipóteses e forma de encerrar.", padroes: [/rescis[ãa]o/i, /resili[çc][ãa]o/i, /den[úu]ncia\s+do\s+contrato/i], severidade: "alta", fundamento: "CC art. 473 (resilição unilateral)" },
  { id: "inadimplemento", nome: "Inadimplemento", oQueOlhar: "Consequências do descumprimento.", padroes: [/inadimpl/i, /descumprimento/i, /mora\b/i], severidade: "alta", fundamento: "CC art. 475 (resolução por inadimplemento)" },
  { id: "multa", nome: "Multa / cláusula penal", oQueOlhar: "Percentual e gatilho da penalidade.", padroes: [/multa/i, /cl[áa]usula\s+penal/i, /penalidade/i], severidade: "alta", fundamento: "CC art. 408-416 (cláusula penal)" },
  { id: "reajuste", nome: "Reajuste / índice", oQueOlhar: "Índice e periodicidade de correção.", padroes: [/reajust/i, /[íi]ndice/i, /\bIPCA\b/i, /\bIGP-?M\b/i, /corre[çc][ãa]o\s+monet/i], severidade: "alta", fundamento: null },
  { id: "garantia", nome: "Garantia", oQueOlhar: "Caução, fiança, seguro ou garantia do produto.", padroes: [/garantia/i, /cau[çc][ãa]o/i, /fian[çc]a/i, /seguro\b/i], severidade: "media", fundamento: null },
  { id: "responsabilidade", nome: "Limitação de responsabilidade", oQueOlhar: "Tetos e exclusões de responsabilidade.", padroes: [/limita[çc][ãa]o\s+de\s+responsabilidade/i, /responsabiliza/i, /n[ãa]o\s+se\s+responsabiliza/i], severidade: "media", fundamento: "CDC art. 51 (cláusulas abusivas, se consumidor)" },
  { id: "indenizacao", nome: "Indenização", oQueOlhar: "Quem indeniza, por quê e limites.", padroes: [/indeniz/i, /perdas\s+e\s+danos/i, /ressarci/i], severidade: "media", fundamento: "CC art. 389" },
  { id: "forca_maior", nome: "Força maior / caso fortuito", oQueOlhar: "Eventos que suspendem obrigações.", padroes: [/for[çc]a\s+maior/i, /caso\s+fortuito/i], severidade: "media", fundamento: "CC art. 393" },
  { id: "confidencialidade", nome: "Confidencialidade", oQueOlhar: "Sigilo e prazo após o término.", padroes: [/confidencial/i, /sigilo/i, /n[ãa]o\s+divulga/i], severidade: "media", fundamento: null },
  { id: "lgpd", nome: "Proteção de dados (LGPD)", oQueOlhar: "Tratamento de dados pessoais e bases legais.", padroes: [/\bLGPD\b/i, /dados\s+pessoais/i, /Lei\s+13\.?709/i], severidade: "alta", fundamento: "Lei 13.709/2018 (LGPD)" },
  { id: "propriedade_intelectual", nome: "Propriedade intelectual", oQueOlhar: "Titularidade de marcas, software, criações.", padroes: [/propriedade\s+intelectual/i, /direitos\s+autorais/i, /\bmarca\b/i, /\bpatente\b/i], severidade: "media", fundamento: null },
  { id: "exclusividade", nome: "Exclusividade", oQueOlhar: "Se há exclusividade e seu escopo.", padroes: [/exclusividade/i, /car[áa]ter\s+exclusivo/i], severidade: "media", fundamento: null },
  { id: "nao_concorrencia", nome: "Não-concorrência", oQueOlhar: "Restrição de concorrência e prazo.", padroes: [/n[ãa]o[-\s]concorr[êe]ncia/i, /n[ãa]o\s+(poder[áa]\s+)?concorrer/i], severidade: "media", fundamento: null },
  { id: "cessao", nome: "Cessão / transferência", oQueOlhar: "Possibilidade de ceder a terceiros.", padroes: [/cess[ãa]o/i, /ceder\s+(este\s+)?contrato/i, /transfer[êe]ncia\s+(deste\s+)?contrato/i], severidade: "baixa", fundamento: null },
  { id: "notificacao", nome: "Notificações", oQueOlhar: "Como as partes se comunicam formalmente.", padroes: [/notifica[çc][ãa]o/i, /comunica[çc][ãa]o\s+por\s+escrito/i], severidade: "baixa", fundamento: null },
  { id: "foro", nome: "Foro de eleição", oQueOlhar: "Comarca para dirimir conflitos.", padroes: [/foro/i, /comarca/i, /elei[çc][ãa]o\s+de\s+foro/i], severidade: "media", fundamento: "CPC art. 63 (foro de eleição)" },
];

export type ItemChecklist = {
  id: string;
  nome: string;
  presente: boolean;
  trecho: string | null; // pedaço LITERAL do contrato (regex), nunca da IA
  severidade: Severidade;
  fundamento: string | null;
  oQueOlhar: string;
};

// Extrai um trecho curto em volta do 1º match (contexto para o humano conferir).
function trechoDe(texto: string, re: RegExp): string | null {
  const m = re.exec(texto);
  if (!m) return null;
  const i = Math.max(0, m.index - 40);
  return texto.slice(i, m.index + m[0].length + 80).replace(/\s+/g, " ").trim();
}

// Varre o texto por TODAS as categorias (cobertura garantida pelo código).
export function rodarChecklist(texto: string): ItemChecklist[] {
  return CATEGORIAS.map((c) => {
    const padraoQueBate = c.padroes.find((re) => re.test(texto)) ?? null;
    return {
      id: c.id,
      nome: c.nome,
      presente: padraoQueBate !== null,
      trecho: padraoQueBate ? trechoDe(texto, padraoQueBate) : null,
      severidade: c.severidade,
      fundamento: c.fundamento,
      oQueOlhar: c.oQueOlhar,
    };
  });
}

// As lacunas que importam: categorias AUSENTES, ordenadas por severidade (o que o
// contrato provavelmente deveria ter e não tem).
export function lacunas(itens: ItemChecklist[]): ItemChecklist[] {
  const ordem: Record<Severidade, number> = { alta: 0, media: 1, baixa: 2 };
  return itens.filter((i) => !i.presente).sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}
