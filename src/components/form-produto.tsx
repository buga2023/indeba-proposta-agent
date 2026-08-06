"use client";

import { useState } from "react";
import { anexoProprio, type Produto } from "@/lib/contracts";

// Formulário de produto (Catálogo → Novo produto / Editar), só para o gestor. O MESMO
// formulário cadastra e edita: os campos são idênticos, e manter dois divergiria na primeira
// mudança — um lado ganharia campo que o outro não sabe salvar.
//
// Cobre a FICHA RICA junto com os dados básicos de propósito: é dela que sai a página de
// produto do PDF (benefícios, diluições, características). Um cadastro que só aceitasse
// nome, foto e PDF geraria produto com página pobre — produto de segunda classe dentro do
// mesmo catálogo. Ver docs/spec-cadastro-produto.md.

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

const METODOS = [
  ["diluidor_automatico", "Diluidor automático"],
  ["pulverizacao", "Pulverização"],
  ["imersao", "Imersão"],
  ["circulacao_cip", "Circulação CIP"],
  ["manual", "Manual"],
] as const;

const UNIDADES = ["L", "kg", "un", "ml"] as const;

// `resto` carrega o que o formulário NÃO mostra (preço, custo diluído, foto por embalagem,
// "como aplicar" da diluição). Sem isso, editar o nome do produto apagaria em silêncio o que
// outra parte do sistema gravou — a edição só pode mexer no que ela de fato exibe.
type Embalagem = {
  tamanho: string;
  unidade: (typeof UNIDADES)[number];
  diluicaoMax: string;
  resto?: Omit<Produto["embalagens"][number], "tamanho" | "unidade" | "diluicaoMax">;
};
type Diluicao = { uso: string; razao: string; comoAplicar?: string };

const EMBALAGEM_VAZIA: Embalagem = { tamanho: "", unidade: "L", diluicaoMax: "" };

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
  return d.length ? d.map((x) => ({ uso: x.uso, razao: x.razao, comoAplicar: x.comoAplicar })) : [{ uso: "", razao: "" }];
}

const campo = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--gray-200)", borderRadius: "9px",
  fontSize: "13.5px", fontFamily: "var(--font-sans), sans-serif", color: "var(--gray-900)",
  background: "white", outline: "none",
} as const;

const rotulo = { display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-body)", marginBottom: "5px" } as const;
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

export function FormProduto({
  onFechar,
  onSalvo,
  produto,
  daBase = false,
}: {
  onFechar: () => void;
  onSalvo: (codigo: string) => void;
  /** Presente = edição de produto existente. Ausente = cadastro novo. */
  produto?: Produto;
  /** Produto dos ~150 do data/catalogo.json. A edição dele vira override, e quem edita
   *  merece saber disso: o arquivo versionado continua lá, intacto, por baixo. */
  daBase?: boolean;
}) {
  const editando = produto != null;
  const car = produto?.ficha?.caracteristicas;

  const [codigo, setCodigo] = useState(produto?.codigo ?? "");
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [marca, setMarca] = useState<"indeba" | "pratt">(produto?.marca ?? "indeba");
  const [linha, setLinha] = useState<(typeof LINHAS)[number][0]>(produto?.linha ?? "limpeza_conservacao");
  const [descricaoCurta, setDescricaoCurta] = useState(produto?.descricaoCurta ?? "");
  const [descricaoUso, setDescricaoUso] = useState(produto?.descricaoUso ?? "");
  const [segmentos, setSegmentos] = useState((produto?.segmentos ?? []).join(", "));
  const [funcoes, setFuncoes] = useState<(typeof FUNCOES)[number][0][]>(
    (produto?.funcoes ?? []) as (typeof FUNCOES)[number][0][],
  );
  const [metodos, setMetodos] = useState<(typeof METODOS)[number][0][]>(
    (produto?.metodos ?? []) as (typeof METODOS)[number][0][],
  );
  const [embalagens, setEmbalagens] = useState<Embalagem[]>(() => embalagensIniciais(produto));
  const [ativo, setAtivo] = useState(produto?.ativo ?? true);

  // Ficha rica
  const [fichaTitulo, setFichaTitulo] = useState(produto?.ficha?.titulo ?? "");
  const [fichaDescricao, setFichaDescricao] = useState(produto?.ficha?.descricao ?? "");
  const [beneficios, setBeneficios] = useState((produto?.ficha?.beneficios ?? []).join("\n"));
  const [pH, setPH] = useState(car?.pH ?? "");
  const [aspecto, setAspecto] = useState(car?.aspecto ?? "");
  const [cor, setCor] = useState(car?.cor ?? "");
  const [odor, setOdor] = useState(car?.odor ?? "");
  const [rendimento, setRendimento] = useState(produto?.ficha?.rendimento ?? "");
  const [diluicoes, setDiluicoes] = useState<Diluicao[]>(() => diluicoesIniciais(produto));

  const [imagem, setImagem] = useState<File | null>(null);
  const [ficha, setFicha] = useState<File | null>(null);
  const [removerFicha, setRemoverFicha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const toggle = <T extends string>(lista: T[], set: (v: T[]) => void) => (v: T) =>
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

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

    if (!codigo.trim() || !nome.trim()) return setErro("Código e nome são obrigatórios.");
    if (!emb.length || emb.some((x) => !Number.isFinite(x.tamanho) || x.tamanho <= 0)) {
      return setErro("Informe ao menos uma embalagem com tamanho válido.");
    }
    if (!funcoes.length) return setErro("Escolha ao menos uma função — é por ela que a seleção automática acha o produto.");
    // Na edição, não anexar foto significa "mantém a que já está lá".
    if (!editando && !imagem) return setErro("A foto do produto é obrigatória.");

    const listaBeneficios = beneficios.split("\n").map((l) => l.trim()).filter(Boolean);
    const listaDiluicoes = diluicoes
      .filter((d) => d.uso.trim() && d.razao.trim())
      .map((d) => ({ uso: d.uso.trim(), razao: d.razao.trim(), ...(d.comoAplicar ? { comoAplicar: d.comoAplicar } : {}) }));
    // Características que o formulário não mostra (uso, densidade, cloro ativo) seguem
    // adiante como estavam — quem não é editado aqui não pode ser apagado daqui.
    const caracteristicas = {
      ...car,
      ...Object.fromEntries(Object.entries({ pH, aspecto, cor, odor }).map(([k, v]) => [k, v.trim() || undefined])),
    };
    const caracteristicasLimpas = Object.fromEntries(Object.entries(caracteristicas).filter(([, v]) => v));
    const fichaRica = {
      // Mesma razão: subtítulo, rótulo de linha e "indicado para" não têm campo na tela.
      ...(produto?.ficha?.subtitulo ? { subtitulo: produto.ficha.subtitulo } : {}),
      ...(produto?.ficha?.linhaLabel ? { linhaLabel: produto.ficha.linhaLabel } : {}),
      ...(produto?.ficha?.indicadoPara ? { indicadoPara: produto.ficha.indicadoPara } : {}),
      ...(fichaTitulo.trim() ? { titulo: fichaTitulo.trim() } : {}),
      ...(fichaDescricao.trim() ? { descricao: fichaDescricao.trim() } : {}),
      ...(listaBeneficios.length ? { beneficios: listaBeneficios } : {}),
      ...(listaDiluicoes.length ? { diluicoes: listaDiluicoes } : {}),
      ...(Object.keys(caracteristicasLimpas).length ? { caracteristicas: caracteristicasLimpas } : {}),
      ...(rendimento.trim() ? { rendimento: rendimento.trim() } : {}),
    };

    const dados = {
      // `fotoEmbalagem` diz qual recipiente a foto mostra (lib/imagem-produto.ts). Não tem
      // campo aqui, então viaja de volta intacto.
      ...(produto?.fotoEmbalagem ? { fotoEmbalagem: produto.fotoEmbalagem } : {}),
      // Código é imutável na edição — é ele que forma o caminho da foto e da ficha; trocar
      // deixaria as propostas já geradas apontando para um produto que não existe mais.
      codigo: (editando ? produto.codigo : codigo.trim().toUpperCase()),
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
      ...(Object.keys(fichaRica).length ? { ficha: fichaRica } : {}),
    };

    const form = new FormData();
    form.append("dados", JSON.stringify(dados));
    if (imagem) form.append("imagem", imagem);
    if (ficha) form.append("ficha", ficha);
    if (editando && removerFicha && !ficha) form.append("removerFicha", "1");

    setSalvando(true);
    try {
      const r = await fetch("/api/produtos", { method: editando ? "PUT" : "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || `Falha ao salvar (HTTP ${r.status}).`);
      onSalvo(d.codigo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      onClick={onFechar}
      style={{ position: "fixed", inset: 0, background: "rgba(14,58,95,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "34px 16px", overflowY: "auto" }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={salvar}
        style={{ background: "white", borderRadius: "16px", padding: "24px 26px", width: "100%", maxWidth: "680px", boxShadow: "var(--shadow-lg)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>
            {editando ? "Editar produto" : "Novo produto"}
          </h2>
          <button type="button" onClick={onFechar} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-subtle)", lineHeight: 1 }}>×</button>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "12px" }}>
          <div>
            <label style={rotulo}>Código {editando ? "" : "*"}</label>
            <input
              style={{ ...campo, ...(editando ? { background: "var(--gray-50)", color: "var(--text-muted)", cursor: "not-allowed" } : {}) }}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="PRIMMAX-NOVO"
              disabled={editando}
              title={editando ? "O código não muda: é ele que liga a foto, a ficha e as propostas já geradas a este produto." : undefined}
            />
          </div>
          <div>
            <label style={rotulo}>Nome *</label>
            <input style={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Primmax Novo" />
          </div>
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

        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Descrição curta</label>
          <input style={campo} value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} placeholder="Detergente desengordurante alcalino" />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Como usar</label>
          <textarea style={{ ...campo, minHeight: "60px", resize: "vertical" }} value={descricaoUso} onChange={(e) => setDescricaoUso(e.target.value)} placeholder="Aplicar por espuma, deixar agir 10 minutos e enxaguar." />
        </div>

        <div style={secao}>Onde o produto se encaixa</div>
        <label style={rotulo}>Funções * <span style={{ fontWeight: 400, color: "var(--text-subtle)" }}>— é por elas que a seleção automática acha o produto</span></label>
        <Chips opcoes={FUNCOES} valor={funcoes} onToggle={toggle(funcoes, setFuncoes)} />
        <label style={{ ...rotulo, marginTop: "14px" }}>Métodos de aplicação</label>
        <Chips opcoes={METODOS} valor={metodos} onToggle={toggle(metodos, setMetodos)} />
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Segmentos <span style={{ fontWeight: 400, color: "var(--text-subtle)" }}>— separados por vírgula</span></label>
          <input style={campo} value={segmentos} onChange={(e) => setSegmentos(e.target.value)} placeholder="laticinio, cozinha_industrial" />
        </div>

        <div style={secao}>Embalagens</div>
        {embalagens.map((emb, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 1.2fr 34px", gap: "8px", marginBottom: "8px", alignItems: "end" }}>
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
            <div>
              {i === 0 && <label style={rotulo}>Diluição máx.</label>}
              <input style={campo} value={emb.diluicaoMax} onChange={(e) => setEmbalagens(embalagens.map((x, j) => (j === i ? { ...x, diluicaoMax: e.target.value } : x)))} placeholder="1:100" />
            </div>
            <button type="button" onClick={() => setEmbalagens(embalagens.length > 1 ? embalagens.filter((_, j) => j !== i) : embalagens)} style={{ height: "38px", border: "1px solid var(--gray-200)", background: "white", borderRadius: "9px", cursor: "pointer", color: "var(--danger)" }} title="Remover">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setEmbalagens([...embalagens, { tamanho: "", unidade: "L", diluicaoMax: "" }])} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: 0 }}>+ outra embalagem</button>

        <div style={secao}>Ficha do produto <span style={{ fontWeight: 400, color: "var(--text-subtle)" }}>— é o que preenche a página dele no PDF</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={rotulo}>Título da ficha</label>
            <input style={campo} value={fichaTitulo} onChange={(e) => setFichaTitulo(e.target.value)} placeholder="Detergente Desengordurante" />
          </div>
          <div>
            <label style={rotulo}>Rendimento</label>
            <input style={campo} value={rendimento} onChange={(e) => setRendimento(e.target.value)} placeholder="1 L rende até 100 L de solução" />
          </div>
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Parágrafo de abertura</label>
          <textarea style={{ ...campo, minHeight: "56px", resize: "vertical" }} value={fichaDescricao} onChange={(e) => setFichaDescricao(e.target.value)} />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label style={rotulo}>Benefícios <span style={{ fontWeight: 400, color: "var(--text-subtle)" }}>— um por linha</span></label>
          <textarea style={{ ...campo, minHeight: "64px", resize: "vertical" }} value={beneficios} onChange={(e) => setBeneficios(e.target.value)} placeholder={"Remove gordura sem agredir o inox\nEnxágue rápido"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginTop: "12px" }}>
          <div><label style={rotulo}>pH</label><input style={campo} value={pH} onChange={(e) => setPH(e.target.value)} placeholder="13,5" /></div>
          <div><label style={rotulo}>Aspecto</label><input style={campo} value={aspecto} onChange={(e) => setAspecto(e.target.value)} placeholder="Líquido" /></div>
          <div><label style={rotulo}>Cor</label><input style={campo} value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Incolor" /></div>
          <div><label style={rotulo}>Odor</label><input style={campo} value={odor} onChange={(e) => setOdor(e.target.value)} placeholder="Característico" /></div>
        </div>

        <label style={{ ...rotulo, marginTop: "14px" }}>Diluições</label>
        {diluicoes.map((d, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 34px", gap: "8px", marginBottom: "8px" }}>
            <input style={campo} value={d.uso} onChange={(e) => setDiluicoes(diluicoes.map((x, j) => (j === i ? { ...x, uso: e.target.value } : x)))} placeholder="limpeza pesada" />
            <input style={campo} value={d.razao} onChange={(e) => setDiluicoes(diluicoes.map((x, j) => (j === i ? { ...x, razao: e.target.value } : x)))} placeholder="1 parte para 50 de água" />
            <button type="button" onClick={() => setDiluicoes(diluicoes.length > 1 ? diluicoes.filter((_, j) => j !== i) : diluicoes)} style={{ height: "38px", border: "1px solid var(--gray-200)", background: "white", borderRadius: "9px", cursor: "pointer", color: "var(--danger)" }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => setDiluicoes([...diluicoes, { uso: "", razao: "" }])} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: 0 }}>+ outra diluição</button>

        <div style={secao}>Arquivos</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={rotulo}>
              Foto do produto {editando ? "" : "*"}{" "}
              <span style={{ fontWeight: 400, color: "var(--text-subtle)" }}>{editando ? "— só se for trocar" : "PNG/JPG"}</span>
            </label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImagem(e.target.files?.[0] ?? null)} style={{ ...campo, padding: "7px" }} />
            {editando && !imagem && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={produto.imagemPath} alt="" style={{ width: "34px", height: "34px", objectFit: "contain", border: "1px solid var(--gray-100)", borderRadius: "7px", background: "white" }} />
                Foto atual — mantida se você não anexar outra.
              </div>
            )}
          </div>
          <div>
            <label style={rotulo}>Ficha técnica <span style={{ fontWeight: 400, color: "var(--text-subtle)" }}>PDF, opcional</span></label>
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

        {editando && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "16px", cursor: "pointer", fontSize: "13px", color: "var(--text-body)" }}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ marginTop: "2px" }} />
            <span>
              Ativo no catálogo
              <span style={{ display: "block", fontSize: "12px", color: "var(--text-subtle)" }}>
                Desmarcado, ele vira <strong>Arquivado</strong>: some dos filtros e da seleção automática, mas continua
                encontrável pela busca e nas propostas já geradas. É o caminho do meio para o produto que saiu de linha —
                {daBase
                  ? " e é por aqui que se tira um produto da base da vitrine, já que ele não se exclui."
                  : " excluir de vez é o botão da lista."}
              </span>
            </span>
          </label>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "22px" }}>
          <button type="button" onClick={onFechar} style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--gray-200)", background: "white", color: "var(--text-body)", fontSize: "13.5px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={salvando} style={{ padding: "10px 22px", borderRadius: "10px", border: "none", background: salvando ? "var(--border)" : "var(--blue-600)", color: "white", fontSize: "13.5px", fontWeight: 700, cursor: salvando ? "default" : "pointer" }}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar produto"}
          </button>
        </div>
      </form>
    </div>
  );
}
