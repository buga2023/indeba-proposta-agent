import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FichaProduto, type Produto } from "./contracts";

// Conteúdo de marketing individualizado por produto (titulo/subtitulo/linha/indicado
// para/benefícios), escrito por produto e mantido em data/catalogo-ficha-rascunho.json.
// É a parte "de venda" da ficha; o dado técnico (rendimento/características/diluição)
// continua no catálogo. Aqui só juntamos os dois para a página de produto sair sempre
// no layout rico (igual à ficha de referência), sem inventar nada em código.
type MarketingRascunho = {
  titulo?: string;
  subtitulo?: string;
  linhaLabel?: string;
  indicadoPara?: { label: string; icone: string }[];
  beneficios?: string[];
};

// Corrige o ícone do "indicado para" a partir do RÓTULO. O rascunho às vezes escolheu
// um ícone genérico (ex.: "selo" para indústria, "pessoa" para hospital) porque o set
// não tinha um melhor; aqui remapeamos pelo texto do rótulo. Se nada casar, mantém o
// ícone do rascunho (nunca regride os já corretos: cozinha, hotel, piso, etc.).
// ORDEM IMPORTA: rótulos são "Substantivo Adjetivo" (ex.: "Cozinha Industrial",
// "Indústria Alimentícia"). Os locais específicos (cozinha, hotel, hospital…) vêm
// ANTES das regras genéricas (industria, predio) — senão "Cozinha Industrial" cairia
// em fábrica por causa do "industrial".
const REGRAS_ICONE: [RegExp, string][] = [
  [/hospital|clinic|consultor|ambulator|\buti\b|enfermar|\bsaude\b|hospitalar|laboratori|farmac|odonto/, "saude"],
  [/escola|faculdad|universidad|\bensino\b|educac|creche/, "escola"],
  [/supermercad|\bmercado\b|varejo|atacad|\bloja\b/, "carrinho"],
  [/lavanderia|lavander|roupas|rouparia/, "lavanderia"],
  [/hortifruti|hortifrut|\bfrutas\b|legumes|lavoura|agricol|agricultura/, "hortifruti"],
  [/cozinha|refeitor|lanchonet|\bcopa\b/, "cozinha"],
  [/restaurant/, "restaurante"],
  [/padaria|confeitar/, "padaria"],
  [/churrasc/, "churrascaria"],
  [/hotel|hotelaria|motel|pousada|hospedagem/, "hotel"],
  [/automotiv|oficina|garage|garagem|combustivel|veicul|onibus|frota|caminhao/, "automotivo"],
  [/banheiro|sanitari|lavabo|dispenser|sabonete|papel|toalha/, "dispenser"],
  [/ralo|calha|\blixo|lixeir|esgoto/, "lixeira"],
  [/aromatiz/, "aromatizador"],
  [/\bpiso|carpete|tapete/, "piso"],
  [/industri|fabrica|frigorific|abatedouro|matadouro|usina|processamento|packing/, "industria"],
  [/escritor|administr|comercio|comercial|corporativ|shopping|instituic/, "predio"],
];

// Remove acentos sem depender de faixa de combining marks (robusto no build).
function semAcento(s: string): string {
  return s
    .replace(/[áàâãä]/gi, "a").replace(/[éèêë]/gi, "e")
    .replace(/[íìîï]/gi, "i").replace(/[óòôõö]/gi, "o")
    .replace(/[úùûü]/gi, "u").replace(/ç/gi, "c").toLowerCase();
}
function resolverIcone(label: string, fallback: string): string {
  const s = semAcento(label);
  for (const [re, ic] of REGRAS_ICONE) if (re.test(s)) return ic;
  return fallback;
}

let rascunhoCache: Record<string, MarketingRascunho> | null = null;

function carregarRascunho(): Record<string, MarketingRascunho> {
  if (rascunhoCache) return rascunhoCache;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "catalogo-ficha-rascunho.json"), "utf-8");
    rascunhoCache = JSON.parse(raw) as Record<string, MarketingRascunho>;
  } catch {
    rascunhoCache = {}; // sem o arquivo, os produtos caem no layout técnico de sempre
  }
  return rascunhoCache;
}

// Junta a ficha do catálogo (técnica) com o marketing individualizado do rascunho.
// Regras:
//  - Ficha de marketing JÁ cadastrada no catálogo (ex.: Primmax Plus/DGClor, escritas
//    à mão) tem prioridade — nunca é sobrescrita pelo rascunho.
//  - `descricao` (parágrafo hero) cai para a descrição curta do produto quando a ficha
//    não traz uma — é dado real do catálogo, não gerado.
//  - Chaves sem valor são podadas para não sujar o snapshot salvo na proposta.
export function enriquecerFicha(p: Produto): Produto["ficha"] {
  const base: FichaProduto = p.ficha ?? {};
  const jaTemMarketing = !!(base.indicadoPara?.length && base.beneficios?.length);
  const mk: MarketingRascunho = jaTemMarketing ? {} : carregarRascunho()[p.codigo] ?? {};

  const bruta: FichaProduto = {
    titulo: base.titulo ?? mk.titulo ?? p.nome,
    subtitulo: base.subtitulo ?? mk.subtitulo,
    linhaLabel: base.linhaLabel ?? mk.linhaLabel,
    descricao: base.descricao ?? (p.descricaoCurta || p.descricaoUso),
    indicadoPara: (base.indicadoPara ?? mk.indicadoPara)?.map((i) => ({
      label: i.label,
      icone: resolverIcone(i.label, i.icone), // corrige ícone genérico pelo rótulo
    })),
    beneficios: base.beneficios ?? mk.beneficios,
    diluicoes: base.diluicoes,
    rendimento: base.rendimento,
    caracteristicas: base.caracteristicas,
  };

  const ficha = Object.fromEntries(
    Object.entries(bruta).filter(([, v]) => v !== undefined && v !== ""),
  ) as FichaProduto;

  // Se não sobrou nada além do título, mantém o que o catálogo já tinha (inclusive null).
  const temConteudo =
    ficha.subtitulo || ficha.linhaLabel || ficha.indicadoPara?.length || ficha.beneficios?.length ||
    ficha.rendimento || ficha.caracteristicas || ficha.diluicoes?.length;
  return temConteudo ? FichaProduto.parse(ficha) : p.ficha ?? null;
}
