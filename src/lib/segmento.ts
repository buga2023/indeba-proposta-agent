// Segmento do cliente → rótulo de LINHA exibido na ficha de produto.
//
// Antes o rótulo vinha de `ficha.linhaLabel`, um campo ESTÁTICO por produto e
// inconsistente (30 valores diferentes, metade em inglês: KITCHEN, AUTO, FOOD,
// LAUNDRY, LINEN…). O consultor montava uma proposta de lavanderia e o PDF anunciava
// "LINHA KITCHEN". O rótulo passa a ser derivado do SEGMENTO escolhido na montagem —
// o dado que o consultor realmente informa (spec Item 2, jul/2026). `linhaLabel`
// continua no contrato como metadado interno, mas não é mais exibido.
//
// A lista abaixo é a seleção controlada oferecida na tela: os segmentos que o catálogo
// realmente usa, com grafia única (o catálogo tem "hospitais"/"hospitalar",
// "escolas"/"educacional", "hotéis"/"hotelaria" como sinônimos soltos). O campo segue
// aceitando texto livre — segmento é faceta expansível (contracts/produto.ts §F2) —,
// então tudo que não está aqui é apenas normalizado.

export type OpcaoSegmento = { valor: string; rotulo: string };

export const SEGMENTOS: OpcaoSegmento[] = [
  { valor: "lavanderia_industrial", rotulo: "Lavanderia Industrial" },
  { valor: "lavanderia_hospitalar", rotulo: "Lavanderia Hospitalar" },
  { valor: "lavanderia_hoteleira", rotulo: "Lavanderia Hoteleira" },
  { valor: "lavanderia_comercial", rotulo: "Lavanderia Comercial" },
  { valor: "hospitalar", rotulo: "Hospitalar" },
  { valor: "saude", rotulo: "Saúde" },
  { valor: "laboratorial", rotulo: "Laboratorial" },
  { valor: "hotelaria", rotulo: "Hotelaria" },
  { valor: "cozinha_industrial", rotulo: "Cozinha Industrial" },
  { valor: "restaurante", rotulo: "Restaurante" },
  { valor: "industria_alimenticia", rotulo: "Indústria Alimentícia" },
  { valor: "industria_bebidas", rotulo: "Indústria de Bebidas" },
  { valor: "laticinios", rotulo: "Laticínios" },
  { valor: "frigorifico", rotulo: "Frigorífico" },
  { valor: "hortifruti", rotulo: "Hortifruti" },
  { valor: "packing_house", rotulo: "Packing House" },
  { valor: "industrial", rotulo: "Industrial" },
  { valor: "automotivo", rotulo: "Automotivo" },
  { valor: "administrativo", rotulo: "Administrativo" },
  { valor: "educacional", rotulo: "Educacional" },
  { valor: "varejo", rotulo: "Varejo" },
  { valor: "supermercado", rotulo: "Supermercado" },
  { valor: "shopping", rotulo: "Shopping" },
  { valor: "tratamento_pisos", rotulo: "Tratamento de Pisos" },
];

// Sinônimos que o catálogo/legado usa para os mesmos segmentos — mapeados para o
// valor canônico, para o rótulo não sair em duas grafias na mesma casa.
const SINONIMOS: Record<string, string> = {
  hospitais: "hospitalar",
  hospital: "hospitalar",
  "clinicas": "saude",
  "hoteis": "hotelaria",
  hotel: "hotelaria",
  "moteis": "hotelaria",
  escolas: "educacional",
  escola: "educacional",
  faculdades: "educacional",
  "instituicoes de ensino": "educacional",
  ensino: "educacional",
  "escritorios": "administrativo",
  escritorio: "administrativo",
  comercial: "administrativo",
  institucional: "administrativo",
  supermercados: "supermercado",
  "shopping centers": "shopping",
  shoppings: "shopping",
  "cozinhas industriais": "cozinha_industrial",
  "refeitorios": "cozinha_industrial",
  "lavanderias hospitalares": "lavanderia_hospitalar",
  "lavanderias industriais": "lavanderia_industrial",
  lavanderia: "lavanderia_industrial",
  frigorificos: "frigorifico",
  "industria_alimentos_bebidas": "industria_alimenticia",
  "alimentos_bebidas": "industria_alimenticia",
  "industrias de alimentos e bebidas": "industria_alimenticia",
  "industrias em geral": "industrial",
  oficinas: "automotivo",
  publico: "administrativo",
};

// Palavras que ficam minúsculas no meio do rótulo ("Indústria de Bebidas").
const MINUSCULAS = new Set(["de", "do", "da", "dos", "das", "e", "em"]);

function semAcento(s: string): string {
  return s
    .replace(/[áàâãä]/gi, "a").replace(/[éèêë]/gi, "e")
    .replace(/[íìîï]/gi, "i").replace(/[óòôõö]/gi, "o")
    .replace(/[úùûü]/gi, "u").replace(/ç/gi, "c");
}

/** Chave de comparação: sem acento, minúsculo, "_" e espaços equivalentes. */
function chave(s: string): string {
  return semAcento(s).toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/_+/g, "_");
}

/**
 * Rótulo legível de um segmento: resolve slug interno e sinônimo para o nome
 * canônico; o que não estiver na lista vira Title Case ("laticínios finos" →
 * "Laticínios Finos"), preservando acento — nunca devolve slug cru com "_".
 */
export function rotuloSegmento(valor: string): string {
  const k = chave(valor);
  const canonico = SINONIMOS[k.replace(/_/g, " ")] ?? SINONIMOS[k] ?? k;
  const opcao = SEGMENTOS.find((s) => chave(s.valor) === chave(canonico));
  if (opcao) return opcao.rotulo;
  return valor
    .trim()
    .replace(/_+/g, " ")
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(semAcento(p).toLowerCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Rótulo de LINHA da ficha de produto, a partir do `cliente.segmento` do escopo.
 * O campo aceita vários segmentos separados por vírgula (tags da tela de montagem);
 * a linha usa o PRIMEIRO — é o que identifica a casa ("LINHA LAVANDERIA HOSPITALAR").
 * Sem segmento informado → null, e a ficha simplesmente não exibe o rótulo (nunca
 * cai de volta no linhaLabel estático em inglês).
 */
export function linhaDoSegmento(segmento: string | null | undefined): string | null {
  const primeiro = (segmento ?? "").split(",").map((s) => s.trim()).filter(Boolean)[0];
  return primeiro ? rotuloSegmento(primeiro).toUpperCase() : null;
}

/**
 * TODOS os segmentos do cliente em texto legível, para exibição (capa da proposta,
 * cabeçalho da revisão). O campo guarda os valores separados por vírgula e pode conter
 * slug interno — a capa chegava a imprimir "lavanderia_hospitalar" cru.
 */
export function segmentosLegiveis(segmento: string | null | undefined): string {
  return (segmento ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(rotuloSegmento)
    .join(" · ");
}
