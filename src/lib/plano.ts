// Plano de ferramentas (revisão de 08/10/2026, item #4). A apresentação comercial vende
// Basic/Regular/Premium como "3/4/5 ferramentas à escolha" numa lista de 7, mas nada no código
// sabia disso: toda instalação entregava tudo. Aqui mora a lista, os presets dos planos e a
// leitura/gravação do que está habilitado — guardado na tabela Config (chave→valor), sem
// migração. Ausente = todas liberadas, para a Indeba (que tem tudo) não mudar de comportamento.
//
// O BLOQUEIO é no servidor (rotas de API), não só no menu: esconder a aba e deixar a rota
// aberta não é plano, é maquiagem.
import { prisma } from "@/lib/db";
import { avisarDegradacao } from "./log-servidor";

export const FERRAMENTAS = [
  { id: "prospeccoes", nome: "Registro de Prospecções", modulo: "Comercial" },
  { id: "visitas-comerciais", nome: "Visitas de Rotina (comercial)", modulo: "Comercial" },
  { id: "solicitacoes", nome: "Solicitações Comerciais", modulo: "Comercial" },
  { id: "visitas-tecnicas", nome: "Visitas de Rotina (técnica)", modulo: "Técnico" },
  { id: "contratos-comodatos", nome: "Contratos e Comodatos", modulo: "Técnico" },
  { id: "estoque-comodatos", nome: "Estoque de Comodatos", modulo: "Técnico" },
  { id: "gerador-contratos", nome: "Gerador de Contratos", modulo: "Técnico" },
] as const;
export type FerramentaId = (typeof FERRAMENTAS)[number]["id"];
export const TODAS: FerramentaId[] = FERRAMENTAS.map((f) => f.id);

// Presets da tabela de planos (apresentacao/planos.html, §2). O gestor Noxis pode ajustar
// ferramenta a ferramenta depois — o preset é só o ponto de partida.
export const PLANOS: Record<"basic" | "regular" | "premium" | "completo", FerramentaId[]> = {
  basic: ["prospeccoes", "visitas-comerciais", "visitas-tecnicas"],
  regular: ["prospeccoes", "visitas-comerciais", "solicitacoes", "visitas-tecnicas"],
  premium: ["prospeccoes", "visitas-comerciais", "solicitacoes", "visitas-tecnicas", "contratos-comodatos", "gerador-contratos"],
  completo: TODAS,
};

const CHAVE = "ferramentas";

/** Interpreta o valor gravado. Qualquer coisa inválida → todas (nunca tranca o cliente fora). */
export function interpretarFerramentas(valor: string | null | undefined): FerramentaId[] {
  if (valor == null) return TODAS;
  try {
    const lista = JSON.parse(valor);
    if (!Array.isArray(lista)) return TODAS;
    const validas = lista.filter((x): x is FerramentaId => typeof x === "string" && (TODAS as string[]).includes(x));
    return validas;
  } catch {
    return TODAS;
  }
}

export async function ferramentasHabilitadas(): Promise<FerramentaId[]> {
  try {
    const c = await prisma.config.findUnique({ where: { chave: CHAVE } });
    return interpretarFerramentas(c?.valor);
  } catch (e) {
    // Banco fora: libera tudo e registra — bloquear ferramenta por falha de infra seria pior.
    avisarDegradacao("plano", "Config indisponível — liberando todas as ferramentas", e);
    return TODAS;
  }
}

export async function salvarFerramentas(ids: string[]): Promise<FerramentaId[]> {
  const lista = [...new Set(ids.filter((x): x is FerramentaId => (TODAS as string[]).includes(x)))];
  const valor = JSON.stringify(lista);
  await prisma.config.upsert({ where: { chave: CHAVE }, update: { valor }, create: { chave: CHAVE, valor } });
  return lista;
}

/** Nome do plano cujo preset bate exatamente com a lista (ou null se for personalizado). */
export function planoDe(ids: readonly string[]): keyof typeof PLANOS | null {
  const s = [...ids].sort().join(",");
  for (const [nome, preset] of Object.entries(PLANOS)) if ([...preset].sort().join(",") === s) return nome as keyof typeof PLANOS;
  return null;
}

/** Para as rotas de API: devolve a resposta 403 pronta quando a ferramenta não está no plano. */
export async function bloqueioDeFerramenta(id: FerramentaId): Promise<Response | null> {
  const ativas = await ferramentasHabilitadas();
  if (ativas.includes(id)) return null;
  const nome = FERRAMENTAS.find((f) => f.id === id)?.nome ?? id;
  return Response.json({ erro: `"${nome}" não está incluída no plano desta instalação. Fale com a Noxis para habilitar.`, ferramenta: id }, { status: 403 });
}
