// Ponte linguagem-natural → CNAE: traduz o "tipo de cliente" que o vendedor descreve
// nos códigos CNAE da base da Receita. Curado e EDITÁVEL — segmentos compradores de
// produtos de limpeza profissional. Códigos no formato da Receita (7 dígitos, sem
// separadores). Valide contra a tabela oficial do IBGE/CONCLA ao expandir.

export type SegmentoCnae = { segmento: string; termos: string[]; cnaes: string[] };

export const SEGMENTOS: SegmentoCnae[] = [
  {
    segmento: "Restaurantes e bares",
    termos: ["restaurante", "bar", "lanchonete", "lanche", "comida", "alimentacao", "cozinha", "food", "buffet", "pizzaria"],
    cnaes: ["5611201", "5611202", "5611203"],
  },
  {
    segmento: "Padarias e confeitarias",
    termos: ["padaria", "confeitaria", "pao", "panificadora", "panificacao"],
    cnaes: ["4721102", "1091102"],
  },
  {
    segmento: "Hotéis e pousadas",
    termos: ["hotel", "hoteis", "pousada", "motel", "hospedagem", "resort", "hostel", "albergue"],
    cnaes: ["5510801", "5510802", "5510803", "5590601", "5590603"],
  },
  {
    segmento: "Saúde e hospitais",
    termos: ["hospital", "clinica", "saude", "laboratorio", "odonto", "consultorio", "medico"],
    cnaes: ["8610101", "8630501", "8630504", "8630599"],
  },
  {
    segmento: "Supermercados e mercados",
    termos: ["supermercado", "mercado", "hipermercado", "minimercado", "mercearia", "atacado", "atacarejo"],
    cnaes: ["4711301", "4711302", "4712100"],
  },
  {
    segmento: "Açougues",
    termos: ["acougue", "carnes", "frigorifico", "casa de carnes"],
    cnaes: ["4722901"],
  },
  {
    segmento: "Academias",
    termos: ["academia", "fitness", "ginastica", "crossfit", "pilates"],
    cnaes: ["9313100"],
  },
  {
    segmento: "Limpeza e facilities",
    termos: ["limpeza", "condominio", "facilities", "conservacao", "zeladoria", "terceirizacao"],
    cnaes: ["8121400", "8122200", "8112500"],
  },
  {
    segmento: "Escolas e educação",
    termos: ["escola", "colegio", "creche", "educacao", "ensino", "faculdade", "universidade"],
    cnaes: ["8513900", "8520100", "8511200"],
  },
  // ── Grandes consumidores de limpeza INDUSTRIAL/profissional ──
  {
    segmento: "Indústria de alimentos e bebidas",
    termos: ["industria de alimentos", "alimenticia", "laticinio", "fabrica de alimentos", "bebidas", "cervejaria", "frigorifico"],
    cnaes: ["1052000", "1053800", "1091101", "1099699", "1111901", "1113502"],
  },
  {
    segmento: "Abatedouros e frigoríficos",
    termos: ["abatedouro", "abate", "frigorifico", "frigorifica"],
    cnaes: ["1011201", "1012101", "1012103", "1013901"],
  },
  {
    segmento: "Lavanderias",
    termos: ["lavanderia", "tinturaria", "lavagem de roupas", "toalheiro"],
    cnaes: ["9601701", "9601702", "9601703"],
  },
  {
    segmento: "Cozinhas industriais e catering",
    termos: ["cozinha industrial", "catering", "refeicoes coletivas", "marmita", "bufe", "buffet", "cantina"],
    cnaes: ["5620101", "5620102", "5620103", "5620104"],
  },
  {
    segmento: "Postos de combustível",
    termos: ["posto", "combustivel", "gasolina", "posto de gasolina"],
    cnaes: ["4731800"],
  },
];

// Normaliza para casar termos: minúsculas, sem acento.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Segmentos detectados no texto livre (tipo de cliente + nicho). Retorna os segmentos
// cujos termos aparecem no texto. Determinístico — sem IA.
export function segmentosDoTexto(texto: string): SegmentoCnae[] {
  const t = norm(texto);
  return SEGMENTOS.filter((s) => s.termos.some((termo) => t.includes(norm(termo))));
}

// CNAEs (união) para o texto do tipo de cliente. Vazio = nicho não mapeado.
export function cnaesDoTexto(texto: string): string[] {
  return [...new Set(segmentosDoTexto(texto).flatMap((s) => s.cnaes))];
}

// Rótulo legível do segmento dado um CNAE (para exibir como "setor" do prospect).
export function segmentoDoCnae(cnae: string): string {
  return SEGMENTOS.find((s) => s.cnaes.includes(cnae))?.segmento ?? "Empresa";
}
