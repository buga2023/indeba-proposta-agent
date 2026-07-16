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
    indicadoPara: base.indicadoPara ?? mk.indicadoPara,
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
