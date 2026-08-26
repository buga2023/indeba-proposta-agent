"use client";

import { useEffect, useState } from "react";
import { anexoProprio, type Produto } from "@/lib/contracts";

// Formulário de produto (Catálogo → Novo produto / Editar), só para o gestor. O MESMO
// formulário cadastra e edita: os campos são idênticos, e manter dois divergiria na primeira
// mudança — um lado ganharia campo que o outro não sabe salvar.
//
// A ORDEM dos campos é a da FICHA TÉCNICA impressa, por pedido do Matheus (06/08/2026): ele
// preenchia com a ficha aberta ao lado e a tela pedia as coisas noutra sequência ("achei que
// aqui ficou meio embolado"). Agora: identificação → arquivos → onde se encaixa → a ficha, na
// ordem em que ela é lida (abertura, benefícios, especificações físico-químicas, composição,
// aplicação, modo de uso, diluições, rendimento) → embalagens. "Cuidados e precauções" ficou de
// fora no mesmo pedido: é conteúdo de rótulo, não de proposta.
//
// Cobre a FICHA RICA junto com os dados básicos de propósito: é dela que sai a página de
// produto do PDF. Um cadastro que só aceitasse nome, foto e PDF geraria produto com página
// pobre — produto de segunda classe dentro do mesmo catálogo. O botão "Preencher a partir da
// ficha" é a ponte entre as duas coisas: lê o PDF e propõe os campos, sem tirar do gestor a
// palavra final. Ver docs/spec-cadastro-produto.md.

const LINHAS = [
  ["lavanderia", "Lavanderia"],
  ["alimentos_bebidas", "Alimentos & Bebidas"],
  ["limpeza_conservacao", "Limpeza & Conservação"],
  ["higiene_clinica", "Higiene Clínica"],
  ["higiene_pessoal", "Higiene Pessoal"],
  ["tratamento_pisos", "Tratamento de Pisos"],
  ["automotiva", "Automotiva"],
] as const;

const FUNCOES = [
  ["desengordurante", "Desengordurante"],
  ["desinfetante", "Desinfetante"],
  ["desincrustante", "Desincrustante"],
  ["sabonete", "Sabonete"],
  ["antisseptico", "Antisséptico"],
  ["multiuso", "Multiuso"],
  ["cip", "CIP (circulação)"],
] as const;

// Métodos saíram da tela em 07/08/2026 ("só os dados que tem na ficha") — sobra o TIPO do
// estado `metodos`, que segue viajando no salvar para preservar o que já está gravado.
type MetodoId = "diluidor_automatico" | "pulverizacao" | "imersao" | "circulacao_cip" | "manual";

const UNIDADES = ["L", "kg", "un", "ml"] as const;

// `resto` carrega o que o formulário NÃO mostra (preço, custo diluído, foto por embalagem).
// Sem isso, editar o nome do produto apagaria em silêncio o que outra parte do sistema
// gravou — a edição só pode mexer no que ela de fato exibe.
type Embalagem = {
  tamanho: string;
  unidade: (typeof UNIDADES)[number];
  diluicaoMax: string;
  resto?: Omit<Produto["embalagens"][number], "tamanho" | "unidade" | "diluicaoMax">;
};
type Diluicao = { uso: string; razao: string; comoAplicar: string };

const EMBALAGEM_VAZIA: Embalagem = { tamanho: "", unidade: "L", diluicaoMax: "" };

// Código gerado do nome no cadastro (pedido do Matheus, 07/08/2026: só os dados que estão na
// ficha; código não está nela). Mesma regra do slug de item próprio (lib/montar.ts).
const codigoDoNome = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function embalagensIniciais(p?: Produto): Embalagem[] {
  if (!p?.embalagens.length) return [EMBALAGEM_VAZIA];
  return p.embalagens.map(({ tamanho, unidade, diluicaoMax, ...resto }) => ({
    tamanho: String(tamanho).replace(".", ","),
    unidade,
    diluicaoMax: diluicaoMax ?? "",
    resto,
  }));
}

function diluicoesIniciais(p?: Produto): Diluicao[] {
  const d = p?.ficha?.diluicoes ?? [];
  return d.length
    ? d.map((x) => ({ uso: x.uso, razao: x.razao, comoAplicar: x.comoAplicar ?? "" }))
    : [{ uso: "", razao: "", comoAplicar: "" }];
}

const campo = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--gray-200)", borderRadius: "9px",
  fontSize: "13.5px", fontFamily: "var(--font-sans), sans-serif", color: "var(--gray-900)",
  background: "white", outline: "none",
} as const;

const rotulo = { display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-body)", marginBottom: "5px" } as const;
const dica = { fontWeight: 400, color: "var(--text-subtle)" } as const;
const secao = { fontSize: "13px", fontWeight: 700, color: "var(--text-strong)", margin: "22px 0 10px", paddingTop: "16px", borderTop: "1px solid var(--border)" } as const;

function Chips<T extends string>({ opcoes, valor, onToggle }: { opcoes: readonly (readonly [T, string])[]; valor: T[]; onToggle: (v: T) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {opcoes.map(([v, label]) => {
        const on = valor.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            style={{
              padding: "6px 12px", borderRadius: "999px", cursor: "pointer", fontSize: "12.5px", fontWeight: 600,
              border: `1px solid ${on ? "var(--blue-600)" : "var(--gray-200)"}`,
              background: on ? "var(--blue-600)" : "white",
              color: on ? "white" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Rascunho automático ──────────────────────────────────────────────────────────────────
// O preenchimento vive no navegador enquanto não for salvo. É a resposta ao "eu cliquei fora
// sem querer e aí eu perdi" (06/08/2026): sair do formulário deixou de ser um ato destrutivo
// — clique no fundo, × ou Esc fecham GUARDANDO, e reabrir devolve tudo onde estava. Só
// "Cancelar" (e o salvamento bem-sucedido) apagam o rascunho.
//
// Arquivos ficam de fora: File não sobrevive ao JSON, e o navegador não deixa repovoar um
// <input type="file"> por código. O aviso da restauração diz isso com todas as letras.
type Rascunho = {
  codigo: string; nome: string; marca: "indeba" | "pratt"; linha: string;
  descricaoCurta: string; descricaoUso: string; segmentos: string;
  funcoes: string[]; metodos: string[]; embalagens: Embalagem[]; ativo: boolean;
  fichaTitulo: string; subtitulo: string; fichaDescricao: string; beneficios: string;
  composicao: string; aplicacao: string; pH: string; aspecto: string; cor: string; odor: string;
  rendimento: string; diluicoes: Diluicao[];
};

// Uma chave por produto (e uma para o cadastro novo): dois rascunhos abertos em dias
// diferentes não se sobrescrevem.
export function chaveRascunho(codigo?: string) {
  return `indeba:rascunho-produto:${codigo ?? "novo"}`;
}

function lerRascunho(chave: string): Partial<Rascunho> | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(chave);
    const d = cru ? (JSON.parse(cru) as unknown) : null;
    return d && typeof d === "object" ? (d as Partial<Rascunho>) : null;
  } catch {
    // localStorage indisponível (modo privativo, cota estourada) não pode derrubar o
    // cadastro: sem rascunho o formulário continua funcionando como sempre funcionou.
    return null;
  }
}

function apagarRascunho(chave: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(chave);
  } catch {
    /* idem: perder o rascunho é aceitável, quebrar a tela não. */
  }
}

// ── Foto: encolhida no navegador antes de subir ──────────────────────────────────────────
// A função da Vercel recusa qualquer requisição acima de ~4,5 MB (FUNCTION_PAYLOAD_TOO_LARGE)
// — e recusa ANTES de o código rodar, então a validação amigável da rota nunca chega a falar.
// Era isso o "Falha ao salvar (HTTP 413)" ao trocar a foto do Spar HT-6 (07/08/2026): foto de
// estúdio em PNG passa fácil dos 5 MB.
//
// Encolher aqui resolve na origem e ainda deixa o upload rápido: 1400px é mais resolução do
// que a página do produto no PDF usa, e WebP preserva a transparência do recorte (o fundo
// vazado é o que faz o produto encaixar no card). Se algo falhar — navegador antigo, canvas
// bloqueado —, devolve o arquivo original: o pior caso é o que já acontecia.
const LADO_MAX = 1400;
const ALVO_BYTES = 1.2 * 1024 * 1024;
// Teto do envio inteiro (foto + ficha + campos). O corte real da Vercel fica entre 4 e 5 MB,
// medido contra a produção em 07/08/2026; 4 MB deixa margem para o resto do formulário.
const LIMITE_ENVIO = 4 * 1024 * 1024;

function pesoLegivel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// Exportada: as fotos das visitas de rotina (ferramentas-tecnicas-screen) encolhem pelo
// mesmo caminho antes de subir.
export async function encolherFoto(file: File): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    // Já pequena e leve: reencodar só perderia qualidade sem ganhar nada.
    if (escala === 1 && file.size <= ALVO_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.92));
    // Navegador sem WebP devolve PNG; o `type` do blob é quem manda no nome e no MIME.
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: blob.type });
  } catch {
    return file;
  }
}

// O que a rota /api/produtos/extrair-ficha devolve — os blocos da ficha técnica em PDF.
type CamposDaFicha = {
  nome?: string;
  titulo?: string;
  descricao?: string;
  composicao?: string;
  aplicacao?: string;
  modoDeUso?: string;
  beneficios?: string[];
  embalagens?: { tamanho: number; unidade: "L" | "kg" | "ml" | "un" }[];
  caracteristicas?: { pH?: string; aspecto?: string; cor?: string; odor?: string };
};

export function FormProduto({
  onFechar,
  onSalvo,
  produto,
  daBase = false,
}: {
  onFechar: () => void;
  onSalvo: (codigo: string) => void;
  /** Presente = edição de produto existente. Ausente = cadastro novo. Vem COMPLETO
   *  (/api/produtos/<codigo>), não do payload enxuto do catálogo: o formulário devolve o
   *  produto inteiro no salvar, e partir de uma versão recortada apagava a ficha. */
  produto?: Produto;
  /** Produto dos ~150 do data/catalogo.json. A edição dele vira override, e quem edita
   *  merece saber disso: o arquivo versionado continua lá, intacto, por baixo. */
  daBase?: boolean;
}) {
  const editando = produto != null;
  const car = produto?.ficha?.caracteristicas;

  // Lido UMA vez, na montagem: depois disso quem manda é o estado da tela. O `key` que a
  // página passa ao trocar de produto remonta o componente e refaz esta leitura.
  const chave = chaveRascunho(produto?.codigo);
  const [salvo] = useState<Partial<Rascunho> | null>(() => lerRascunho(chave));

  // Sem input próprio desde 07/08/2026 — sobrevivem do rascunho/produto e viajam no salvar.
  const [codigo] = useState(salvo?.codigo ?? produto?.codigo ?? "");
  const [nome, setNome] = useState(salvo?.nome ?? produto?.nome ?? "");
  const [marca, setMarca] = useState<"indeba" | "pratt">(salvo?.marca ?? produto?.marca ?? "indeba");
  const [linha, setLinha] = useState<(typeof LINHAS)[number][0]>(
    (salvo?.linha as (typeof LINHAS)[number][0]) ?? produto?.linha ?? "limpeza_conservacao",
  );
  const [descricaoCurta, setDescricaoCurta] = useState(salvo?.descricaoCurta ?? produto?.descricaoCurta ?? "");
  const [descricaoUso, setDescricaoUso] = useState(salvo?.descricaoUso ?? produto?.descricaoUso ?? "");
  const [segmentos] = useState(salvo?.segmentos ?? (produto?.segmentos ?? []).join(", "));
  const [funcoes, setFuncoes] = useState<(typeof FUNCOES)[number][0][]>(
    (salvo?.funcoes ?? produto?.funcoes ?? []) as (typeof FUNCOES)[number][0][],
  );
  const [metodos] = useState<MetodoId[]>((salvo?.metodos ?? produto?.metodos ?? []) as MetodoId[]);
  const [embalagens, setEmbalagens] = useState<Embalagem[]>(() => salvo?.embalagens ?? embalagensIniciais(produto));
  const [ativo, setAtivo] = useState(salvo?.ativo ?? produto?.ativo ?? true);

  // Ficha rica
  const [fichaTitulo, setFichaTitulo] = useState(salvo?.fichaTitulo ?? produto?.ficha?.titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(salvo?.subtitulo ?? produto?.ficha?.subtitulo ?? "");
  const [fichaDescricao, setFichaDescricao] = useState(salvo?.fichaDescricao ?? produto?.ficha?.descricao ?? "");
  const [beneficios, setBeneficios] = useState(salvo?.beneficios ?? (produto?.ficha?.beneficios ?? []).join("\n"));
  const [composicao, setComposicao] = useState(salvo?.composicao ?? produto?.ficha?.composicao ?? "");
  const [aplicacao, setAplicacao] = useState(salvo?.aplicacao ?? produto?.ficha?.aplicacao ?? "");
  const [pH, setPH] = useState(salvo?.pH ?? car?.pH ?? "");
  const [aspecto, setAspecto] = useState(salvo?.aspecto ?? car?.aspecto ?? "");
  const [cor, setCor] = useState(salvo?.cor ?? car?.cor ?? "");
  const [odor, setOdor] = useState(salvo?.odor ?? car?.odor ?? "");
  const [rendimento, setRendimento] = useState(salvo?.rendimento ?? produto?.ficha?.rendimento ?? "");
  const [diluicoes, setDiluicoes] = useState<Diluicao[]>(() => salvo?.diluicoes ?? diluicoesIniciais(produto));

  const [imagem, setImagem] = useState<File | null>(null);
  // Linha discreta abaixo do campo de foto: "8,4 MB → 240 KB". Encolher a foto do gestor
  // sem dizer nada seria mexer no arquivo dele às escondidas.
  const [fotoInfo, setFotoInfo] = useState<string | null>(null);
  const [ficha, setFicha] = useState<File | null>(null);
  const [removerFicha, setRemoverFicha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [lendoFicha, setLendoFicha] = useState(false);
  const [aviso, setAviso] = useState<string | null>(
    salvo
      ? "Recuperei o que você tinha preenchido antes de sair — confira e salve. Foto e ficha em PDF, se você tinha anexado, precisam ser anexadas de novo. Para começar do zero, use Cancelar e abra outra vez."
      : null,
  );
  // Qualquer digitação marca o formulário como sujo. Serve para duas coisas: guardar o
  // rascunho e fazer o Cancelar perguntar antes de jogar o preenchimento fora. Rascunho
  // restaurado já nasce sujo — ele É trabalho não salvo.
  const [tocado, setTocado] = useState(salvo != null);

  const toggle = <T extends string>(lista: T[], set: (v: T[]) => void) => (v: T) => {
    setTocado(true);
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  };

  // O retrato serializável do formulário. É o que vai para o rascunho a cada digitação —
  // gravar continuamente, e não só na saída, cobre também o fechar da aba e o F5.
  const rascunho: Rascunho = {
    codigo, nome, marca, linha, descricaoCurta, descricaoUso, segmentos, funcoes, metodos,
    embalagens, ativo, fichaTitulo, subtitulo, fichaDescricao, beneficios, composicao,
    aplicacao, pH, aspecto, cor, odor, rendimento, diluicoes,
  };
  const serializado = JSON.stringify(rascunho);

  useEffect(() => {
    if (!tocado) return;
    try {
      window.localStorage.setItem(chave, serializado);
    } catch {
      /* sem espaço/sem permissão: segue sem rascunho, o formulário não pode quebrar. */
    }
  }, [chave, serializado, tocado]);

  // Sair GUARDANDO — é o que fazem o × e o Esc. Nada se perde e nada pergunta: o
  // preenchimento já está no rascunho e volta inteiro no próximo "editar". (O clique no
  // fundo não fecha; ver o comentário do backdrop lá embaixo.)
  function sairGuardando() {
    onFechar();
  }

  // Sair DESCARTANDO — só o Cancelar, que é o botão de quem quer mesmo jogar fora. Com
  // trabalho em cima, confirma antes; é a única porta que apaga o rascunho.
  function cancelar() {
    if (tocado && !window.confirm("Descartar o que você preencheu? Isso apaga também o rascunho guardado.")) return;
    apagarRascunho(chave);
    onFechar();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  // Lê a ficha técnica em PDF e propõe os campos. Não salva nada: preenche a tela para o
  // gestor conferir. Só escreve onde ele ainda não escreveu — quem já digitou tem prioridade
  // sobre o que veio do arquivo.
  async function preencherPelaFicha() {
    setErro(null);
    setAviso(null);
    setLendoFicha(true);
    try {
      let r: Response;
      if (ficha) {
        const fd = new FormData();
        fd.append("ficha", ficha);
        r = await fetch("/api/produtos/extrair-ficha", { method: "POST", body: fd });
      } else {
        r = await fetch(`/api/produtos/extrair-ficha?codigo=${encodeURIComponent(produto?.codigo ?? "")}`, { method: "POST" });
      }
      const d = (await r.json().catch(() => ({}))) as { campos?: CamposDaFicha; erro?: string };
      if (!r.ok) throw new Error(d.erro || `Não consegui ler a ficha (HTTP ${r.status}).`);
      const c = d.campos ?? {};
      const preenchidos: string[] = [];
      const aplicar = (valor: string | undefined, atual: string, set: (v: string) => void, nomeCampo: string) => {
        if (!valor || atual.trim()) return;
        set(valor);
        preenchidos.push(nomeCampo);
      };
      // Auto-cadastro (pedido do CEO, ago/2026): a ficha traz também o nome comercial, a
      // categoria e as embalagens — anexou o PDF, o cadastro se preenche inteiro. A regra
      // continua a mesma: só entra onde o gestor ainda não escreveu, e ele confirma no salvar.
      aplicar(c.nome, nome, setNome, "nome");
      aplicar(c.titulo, fichaTitulo, setFichaTitulo, "título");
      aplicar(c.descricao, fichaDescricao, setFichaDescricao, "abertura");
      aplicar(c.descricao, descricaoCurta, setDescricaoCurta, "descrição curta");
      aplicar(c.beneficios?.join("\n"), beneficios, setBeneficios, "benefícios");
      aplicar(c.caracteristicas?.pH, pH, setPH, "pH");
      aplicar(c.caracteristicas?.aspecto, aspecto, setAspecto, "aspecto");
      aplicar(c.caracteristicas?.cor, cor, setCor, "cor");
      aplicar(c.caracteristicas?.odor, odor, setOdor, "odor");
      aplicar(c.composicao, composicao, setComposicao, "composição");
      aplicar(c.aplicacao, aplicacao, setAplicacao, "aplicação");
      aplicar(c.modoDeUso, descricaoUso, setDescricaoUso, "modo de uso");
      // Embalagens: só quando a tela ainda não tem nenhuma preenchida (mesma prioridade
      // dos campos de texto — o que o gestor digitou nunca é sobrescrito).
      if (c.embalagens?.length && !embalagens.some((e) => e.tamanho.trim())) {
        setEmbalagens(c.embalagens.map((e) => ({ tamanho: String(e.tamanho).replace(".", ","), unidade: e.unidade, diluicaoMax: "" })));
        preenchidos.push("embalagens");
      }
      setTocado(true);
      setAviso(
        preenchidos.length
          ? `Preenchi ${preenchidos.join(", ")} com o texto da ficha. Confira antes de salvar — o que você já tinha escrito foi mantido.`
          : "A ficha não trouxe nada além do que você já preencheu.",
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler a ficha.");
    } finally {
      setLendoFicha(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const emb = embalagens
      .filter((x) => x.tamanho.trim())
      .map((x) => ({
        // Preço NÃO é cadastrado aqui: o catálogo é fonte de produto, e o valor vem do
        // humano na montagem (constituição §1.2). Nenhum produto do catálogo tem preço.
        preco: null,
        custoDiluido: null,
        ...x.resto,
        tamanho: Number(x.tamanho.replace(",", ".")),
        unidade: x.unidade,
        diluicaoMax: x.diluicaoMax.trim() || null,
      }));

    if (!nome.trim()) return setErro("O nome do produto é obrigatório.");
    if (!emb.length || emb.some((x) => !Number.isFinite(x.tamanho) || x.tamanho <= 0)) {
      return setErro("Informe ao menos uma embalagem com tamanho válido.");
    }
    if (!funcoes.length) return setErro("Escolha ao menos uma função — é por ela que a seleção automática acha o produto.");
    // Na edição, não anexar foto significa "mantém a que já está lá".
    if (!editando && !imagem) return setErro("A foto do produto é obrigatória.");
    // O corte de ~4,5 MB é da plataforma e vale para o ENVIO INTEIRO (foto + ficha + campos).
    // Barrar aqui é o que transforma um "HTTP 413" em uma frase que diz o que fazer.
    const pesoAnexos = (imagem?.size ?? 0) + (ficha?.size ?? 0);
    if (pesoAnexos > LIMITE_ENVIO) {
      return setErro(
        `Os anexos somam ${pesoLegivel(pesoAnexos)} e o envio aceita até ${pesoLegivel(LIMITE_ENVIO)}. ` +
          (ficha && ficha.size > LIMITE_ENVIO / 2
            ? "A ficha em PDF é a parte pesada — salve o produto sem ela e anexe uma versão mais leve depois."
            : "Anexe uma foto menor."),
      );
    }

    const listaBeneficios = beneficios.split("\n").map((l) => l.trim()).filter(Boolean);
    const listaDiluicoes = diluicoes
      .filter((d) => d.uso.trim() && d.razao.trim())
      .map((d) => ({ uso: d.uso.trim(), razao: d.razao.trim(), ...(d.comoAplicar.trim() ? { comoAplicar: d.comoAplicar.trim() } : {}) }));

    // Campo gerenciado pela tela viaja SEMPRE, mesmo em branco: no servidor, ausente
    // significa "não mexi" e vazio significa "apaguei" (lib/produto-merge.ts). Sem essa
    // distinção, limpar um subtítulo errado seria impossível — o valor antigo voltaria.
    // Já subtítulo herdado, linhaLabel e "indicado para" ficam de fora quando não têm campo
    // aqui: o merge os preserva do que estava gravado.
    const fichaRica = {
      titulo: fichaTitulo.trim(),
      subtitulo: subtitulo.trim(),
      descricao: fichaDescricao.trim(),
      beneficios: listaBeneficios,
      composicao: composicao.trim(),
      aplicacao: aplicacao.trim(),
      diluicoes: listaDiluicoes,
      rendimento: rendimento.trim(),
      // Uso, densidade e cloro ativo não têm campo na tela: omitidos, o merge preserva.
      caracteristicas: { pH: pH.trim(), aspecto: aspecto.trim(), cor: cor.trim(), odor: odor.trim() },
    };

    const dados = {
      // Código é imutável na edição — é ele que forma o caminho da foto e da ficha; trocar
      // deixaria as propostas já geradas apontando para um produto que não existe mais.
      // No cadastro ele é GERADO do nome (o campo saiu da tela em 07/08/2026 — a ficha
      // técnica não tem código): rascunho antigo com código digitado ainda prevalece.
      codigo: editando ? produto.codigo : (codigo.trim() ? codigo.trim().toUpperCase() : codigoDoNome(nome)),
      nome: nome.trim(),
      marca,
      linha,
      descricaoCurta: descricaoCurta.trim() || nome.trim(),
      descricaoUso: descricaoUso.trim() || descricaoCurta.trim() || nome.trim(),
      segmentos: segmentos.split(",").map((s) => s.trim()).filter(Boolean),
      funcoes,
      metodos,
      embalagens: emb,
      ...(editando ? { ativo } : {}),
      ficha: fichaRica,
    };

    const form = new FormData();
    form.append("dados", JSON.stringify(dados));
    if (imagem) form.append("imagem", imagem);
    if (ficha) form.append("ficha", ficha);
    if (editando && removerFicha && !ficha) form.append("removerFicha", "1");

    setSalvando(true);
    try {
      const r = await fetch("/api/produtos", { method: editando ? "PUT" : "POST", body: form });
      // 413 não passa pela rota: quem responde é a borda da Vercel, e em HTML — daí a
      // mensagem escrita aqui. Rede de segurança para o que a checagem acima não previu.
      if (r.status === 413) {
        throw new Error("Os arquivos anexados são grandes demais para o envio. Anexe uma foto ou uma ficha em PDF mais leve — o limite da plataforma é de cerca de 4 MB por envio.");
      }
      const d = await r.json().catch(() => ({}));
      // O gestor não vê mais o código — o 409 de colisão precisa falar em NOME.
      if (r.status === 409 && !editando) {
        throw new Error("Já existe um produto com esse nome no catálogo. Ajuste o nome (ex.: acrescente o tamanho ou a variação) e salve de novo.");
      }
      if (!r.ok) throw new Error(d.erro || `Falha ao salvar (HTTP ${r.status}).`);
      // Gravado no servidor: o rascunho cumpriu o papel e sai de cena. Sem isto, o próximo
      // "editar" deste produto abriria com o texto de antes por cima do que acabou de valer.
      apagarRascunho(chave);
      onSalvo(d.codigo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const podeLerFicha = !!ficha || (editando && !!produto.fichaTecnicaPath);

  return (
    <div
      // O clique no fundo NÃO fecha — decisão do gestor (07/08/2026), depois de a versão que
      // fechava guardando o rascunho ainda ter lido como "cliquei e saiu". Sair é ato
      // deliberado: × , Esc, Cancelar ou Salvar. O aviso responde ao clique para ele não
      // parecer um controle morto.
      onClick={() => setAviso("Para sair, use o × no alto, Cancelar ou Salvar — clicar aqui fora não fecha o formulário.")}
      style={{ position: "fixed", inset: 0, background: "rgba(14,58,95,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "34px 16px", overflowY: "auto" }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onChange={() => setTocado(true)}
        onSubmit={salvar}
        style={{ background: "white", borderRadius: "16px", padding: "24px 26px", width: "100%", maxWidth: "680px", boxShadow: "var(--shadow-lg)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>
            {editando ? "Editar produto" : "Novo produto"}
          </h2>
          <button type="button" onClick={sairGuardando} title="Fechar — o que você preencheu fica guardado" style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-subtle)", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "16px" }}>
          {editando
            ? daBase
              ? "Produto da base Indeba/Pratt. Sua correção é gravada por cima e passa a valer na hora — o catálogo original fica intacto por baixo, e as propostas já geradas não mudam."
              : "A alteração vale na hora, inclusive para propostas montadas daqui em diante. Preço continua vindo de você na montagem."
            : "Entra no catálogo na hora, disponível para montar proposta. Preço não se cadastra aqui — ele vem de você na montagem."}
        </div>

        {erro && (
          <div style={{ background: "var(--danger-soft)", border: "1px solid #fecaca", color: "var(--danger)", borderRadius: "10px", padding: "10px 13px", fontSize: "13px", marginBottom: "14px" }}>{erro}</div>
        )}
        {aviso && (
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", background: "var(--info-soft)", border: "1px solid var(--blue-200, #a8cbea)", color: "var(--text-body)", borderRadius: "10px", padding: "10px 13px", fontSize: "12.5px", marginBottom: "14px" }}>
            <span style={{ flex: 1 }}>{aviso}</span>
            <button type="button" onClick={() => setAviso(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-subtle)", fontSize: "15px", lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Código saiu da tela (07/08/2026): não está na ficha técnica. No cadastro ele é
            gerado do nome; na edição é imutável de qualquer forma. */}
        <div>
          <label style={rotulo}>Nome *</label>
          <input style={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Primmax Novo" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "12px", marginTop: "12px" }}>
          <div>
            <label style={rotulo}>Marca</label>
            <select style={campo} value={marca} onChange={(e) => setMarca(e.target.value as "indeba" | "pratt")}>
              <option value="indeba">Indeba</option>
              <option value="pratt">Pratt</option>
            </select>
          </div>
          <div>
            <label style={rotulo}>Linha</label>
            <select style={campo} value={linha} onChange={(e) => setLinha(e.target.value as typeof linha)}>
              {LINHAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
          <div>
            <label style={rotulo}>Título da ficha <span style={dica}>— a categoria impressa</span></label>
            <input style={campo} value={fichaTitulo} onChange={(e) => setFichaTitulo(e.target.value)} placeholder="Detergente Desengordurante" />
          </div>
          <div>
            <label style={rotulo}>Subtítulo</label>
            <input style={campo} value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} placeholder="Alcalino Concentrado" />
          </div>
        </div>

        <div style={secao}>Foto e ficha técnica</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={rotulo}>
              Foto do produto {editando ? "" : "*"}{" "}
              <span style={dica}>{editando ? "— só se for trocar" : "PNG/JPG"}</span>
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const original = e.target.files?.[0] ?? null;
                setTocado(true);
                if (!original) {
                  setImagem(null);
                  setFotoInfo(null);
                  return;
                }
                setImagem(original);
                setFotoInfo("Preparando a foto…");
                const leve = await encolherFoto(original);
                setImagem(leve);
                setFotoInfo(
                  leve === original
                    ? pesoLegivel(original.size)
                    : `${pesoLegivel(original.size)} → ${pesoLegivel(leve.size)} (reduzida para caber no envio)`,
                );
              }}
              style={{ ...campo, padding: "7px" }}
            />
            {fotoInfo && <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-subtle)" }}>{fotoInfo}</div>}
            {editando && !imagem && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={produto.imagemPath} alt="" style={{ width: "34px", height: "34px", objectFit: "contain", border: "1px solid var(--gray-100)", borderRadius: "7px", background: "white" }} />
                Foto atual — mantida se você não anexar outra.
              </div>
            )}
          </div>
          <div>
            <label style={rotulo}>Ficha técnica <span style={dica}>PDF até 4 MB, opcional</span></label>
            <input type="file" accept="application/pdf" onChange={(e) => setFicha(e.target.files?.[0] ?? null)} style={{ ...campo, padding: "7px" }} />
            {editando && produto.fichaTecnicaPath && !ficha && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                <a href={produto.fichaTecnicaPath} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600 }}>Ver ficha atual</a>
                {/* Ficha herdada da base mora no repositório, não no banco: não há o que
                    apagar, e a rota recusa o pedido. Oferecer a caixa aqui seria prometer uma
                    ação que não acontece — em vez dela, a frase que diz como trocar. */}
                {anexoProprio(produto.fichaTecnicaPath) ? (
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", cursor: "pointer" }}>
                    <input type="checkbox" checked={removerFicha} onChange={(e) => setRemoverFicha(e.target.checked)} />
                    Remover a ficha deste produto
                  </label>
                ) : (
                  <div style={{ marginTop: "6px", color: "var(--text-subtle)" }}>Vem da base Indeba/Pratt — para trocar, anexe uma nova.</div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* O atalho que o Matheus pediu: em vez de copiar oito blocos do PDF à mão, a ficha
            preenche os campos e ele confere. Só aparece quando existe PDF para ler. */}
        {podeLerFicha && (
          <button
            type="button"
            onClick={preencherPelaFicha}
            disabled={lendoFicha}
            style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--blue-200, #a8cbea)", background: "var(--info-soft)", color: "var(--primary)", fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: lendoFicha ? "default" : "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 2h5l3.5 3.5V13a.5.5 0 01-.5.5h-8A.5.5 0 013 13V2.5a.5.5 0 01.5-.5z" />
              <path d="M8.5 2v3.5H12M5.5 8.5h4M5.5 11h2.5" />
            </svg>
            {lendoFicha ? "Lendo a ficha…" : "Preencher campos a partir da ficha"}
          </button>
        )}

        {/* Métodos, segmentos e descrição curta saíram da tela (07/08/2026 — "só os dados que
            tem na ficha"): os valores existentes seguem preservados no salvar, e a descrição
            curta herda o nome/abertura. Funções fica: sem elas a seleção automática não acha
            o produto. */}
        <div style={secao}>Onde o produto se encaixa</div>
        <label style={rotulo}>Funções * <span style={dica}>— é por elas que a seleção automática acha o produto</span></label>
        <Chips opcoes={FUNCOES} valor={funcoes} onToggle={toggle(funcoes, setFuncoes)} />

        <div style={secao}>A ficha do produto <span style={dica}>— na ordem da ficha técnica; é o que preenche a página dele no PDF</span></div>
        <div>
          <label style={rotulo}>Parágrafo de abertura <span style={dica}>— abre a página do produto no PDF</span></label>
          <textarea style={{ ...campo, minHeight: "56px", resize: "vertical" }} value={fichaDescricao} onChange={(e) => setFichaDescricao(e.target.value)} />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Benefícios <span style={dica}>— um por linha</span></label>
          <textarea style={{ ...campo, minHeight: "64px", resize: "vertical" }} value={beneficios} onChange={(e) => setBeneficios(e.target.value)} placeholder={"Remove gordura sem agredir o inox\nEnxágue rápido"} />
        </div>
        {/* Na ficha impressa, as ESPECIFICAÇÕES FÍSICO-QUÍMICAS abrem as informações
            técnicas — antes de composição, aplicação e modo de uso (ver Alvaclor 165). */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginTop: "12px" }}>
          <div><label style={rotulo}>pH</label><input style={campo} value={pH} onChange={(e) => setPH(e.target.value)} placeholder="13,5" /></div>
          <div><label style={rotulo}>Aspecto</label><input style={campo} value={aspecto} onChange={(e) => setAspecto(e.target.value)} placeholder="Líquido" /></div>
          <div><label style={rotulo}>Cor</label><input style={campo} value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Incolor" /></div>
          <div><label style={rotulo}>Odor</label><input style={campo} value={odor} onChange={(e) => setOdor(e.target.value)} placeholder="Característico" /></div>
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Composição</label>
          <textarea style={{ ...campo, minHeight: "50px", resize: "vertical" }} value={composicao} onChange={(e) => setComposicao(e.target.value)} placeholder="Tensoativo aniônico, alcalinizante, sequestrante, conservante e veículo." />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Aplicação <span style={dica}>— onde o produto é usado</span></label>
          <textarea style={{ ...campo, minHeight: "50px", resize: "vertical" }} value={aplicacao} onChange={(e) => setAplicacao(e.target.value)} placeholder="Limpeza geral de sujidades orgânicas em cozinhas profissionais e indústria de alimentos." />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Modo de uso</label>
          <textarea style={{ ...campo, minHeight: "60px", resize: "vertical" }} value={descricaoUso} onChange={(e) => setDescricaoUso(e.target.value)} placeholder="Aplicar por espuma, deixar agir 10 minutos e enxaguar." />
        </div>

        <label style={{ ...rotulo, marginTop: "14px" }}>Diluições <span style={dica}>— finalidade, proporção e, se a ficha trouxer, como aplicar</span></label>
        {diluicoes.map((d, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr 34px", gap: "8px", marginBottom: "8px" }}>
            <input style={campo} value={d.uso} onChange={(e) => setDiluicoes(diluicoes.map((x, j) => (j === i ? { ...x, uso: e.target.value } : x)))} placeholder="limpeza pesada" />
            <input style={campo} value={d.razao} onChange={(e) => setDiluicoes(diluicoes.map((x, j) => (j === i ? { ...x, razao: e.target.value } : x)))} placeholder="1 parte para 50 de água" />
            <input style={campo} value={d.comoAplicar} onChange={(e) => setDiluicoes(diluicoes.map((x, j) => (j === i ? { ...x, comoAplicar: e.target.value } : x)))} placeholder="pulverizar e enxaguar" />
            <button type="button" onClick={() => setDiluicoes(diluicoes.length > 1 ? diluicoes.filter((_, j) => j !== i) : diluicoes)} style={{ height: "38px", border: "1px solid var(--gray-200)", background: "white", borderRadius: "9px", cursor: "pointer", color: "var(--danger)" }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => setDiluicoes([...diluicoes, { uso: "", razao: "", comoAplicar: "" }])} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: 0 }}>+ outra diluição</button>

        <div style={{ marginTop: "16px" }}>
          <label style={rotulo}>Rendimento</label>
          <input style={campo} value={rendimento} onChange={(e) => setRendimento(e.target.value)} placeholder="1 L rende até 100 L de solução" />
        </div>

        <div style={secao}>Embalagens <span style={dica}>— os tamanhos que a ficha lista</span></div>
        {/* A diluição máx. por embalagem saiu da tela (07/08/2026): as diluições já são
            cadastradas acima, como na ficha. O valor gravado por embalagem é preservado. */}
        {embalagens.map((emb, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 34px", gap: "8px", marginBottom: "8px", alignItems: "end" }}>
            <div>
              {i === 0 && <label style={rotulo}>Tamanho *</label>}
              <input style={campo} value={emb.tamanho} onChange={(e) => setEmbalagens(embalagens.map((x, j) => (j === i ? { ...x, tamanho: e.target.value } : x)))} placeholder="5" />
            </div>
            <div>
              {i === 0 && <label style={rotulo}>Un.</label>}
              <select style={campo} value={emb.unidade} onChange={(e) => setEmbalagens(embalagens.map((x, j) => (j === i ? { ...x, unidade: e.target.value as Embalagem["unidade"] } : x)))}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setEmbalagens(embalagens.length > 1 ? embalagens.filter((_, j) => j !== i) : embalagens)} style={{ height: "38px", border: "1px solid var(--gray-200)", background: "white", borderRadius: "9px", cursor: "pointer", color: "var(--danger)" }} title="Remover">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setEmbalagens([...embalagens, { tamanho: "", unidade: "L", diluicaoMax: "" }])} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: 0 }}>+ outra embalagem</button>

        {editando && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "16px", cursor: "pointer", fontSize: "13px", color: "var(--text-body)" }}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ marginTop: "2px" }} />
            <span>
              Ativo no catálogo
              <span style={{ display: "block", fontSize: "12px", color: "var(--text-subtle)" }}>
                Desmarcado, ele vira <strong>Arquivado</strong>: some dos filtros e da seleção automática, mas continua
                encontrável pela busca e nas propostas já geradas. É o caminho do meio para o produto que saiu de linha —
                excluir de vez é o botão da lista.
              </span>
            </span>
          </label>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "22px" }}>
          <button type="button" onClick={cancelar} title="Descarta o preenchimento e o rascunho guardado" style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--gray-200)", background: "white", color: "var(--text-body)", fontSize: "13.5px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={salvando} style={{ padding: "10px 22px", borderRadius: "10px", border: "none", background: salvando ? "var(--border)" : "var(--blue-600)", color: "white", fontSize: "13.5px", fontWeight: 700, cursor: salvando ? "default" : "pointer" }}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar produto"}
          </button>
        </div>
      </form>
    </div>
  );
}
