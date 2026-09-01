"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Chamado, CategoriaChamado, PrioridadeChamado, StatusChamado } from "@/lib/contracts";
import { autorLabel } from "@/lib/utils";

const CATEGORIAS: { value: CategoriaChamado; label: string }[] = [
  { value: "bug", label: "Bug / erro" },
  { value: "duvida", label: "Dúvida" },
  { value: "sugestao", label: "Sugestão" },
  { value: "infra", label: "Infraestrutura" },
  { value: "outro", label: "Outro" },
];
const PRIORIDADES: { value: PrioridadeChamado; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];
const STATUS_INFO: Record<StatusChamado, { label: string; cor: string; bg: string }> = {
  aberto: { label: "Aberto", cor: "#b45309", bg: "#fef3c7" },
  em_andamento: { label: "Em andamento", cor: "#1e6bb8", bg: "#e0edfb" },
  resolvido: { label: "Resolvido", cor: "#15803d", bg: "#dcfce7" },
};
const PRIO_COR: Record<PrioridadeChamado, string> = { baixa: "#64748b", media: "#d97706", alta: "#dc2626" };
const STATUS_FLUXO: StatusChamado[] = ["aberto", "em_andamento", "resolvido"];

const rotuloCategoria = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label ?? v;

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--gray-200)",
  borderRadius: "10px",
  fontSize: "14px",
  fontFamily: "'Inter',sans-serif",
  color: "var(--gray-900)",
  background: "white",
  outline: "none",
} as const;

export function ChamadosScreen() {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [souGestor, setSouGestor] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaChamado>("outro");
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>("media");
  const [enviando, setEnviando] = useState(false);

  // `setErro(null)` depois do await: no mount isto roda dentro de um effect, e setState
  // síncrono ali encadeia render extra (React 19 acusa). Ver admin-screen.tsx.
  async function carregar() {
    try {
      const r = await fetch("/api/chamados");
      const d = await r.json();
      if (!r.ok) throw new Error(typeof d.erro === "string" ? d.erro : "Falha ao carregar os chamados.");
      setErro(null);
      setChamados(d.chamados);
      setSouGestor(d.souGestor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar os chamados.");
    } finally {
      setCarregando(false);
    }
  }
  // Carrega no mount por callback de promise: chamar `carregar()` direto no corpo do effect
  // faz setState síncrono e encadeia render extra (React 19 acusa) — mesmo motivo pelo qual
  // ajuda-chat.tsx dispara o catálogo com fetch().then().
  useEffect(() => {
    void Promise.resolve().then(carregar);
  }, []);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    if (titulo.trim().length < 3 || descricao.trim().length < 5) {
      setErro("Dê um título (3+ caracteres) e descreva o problema (5+ caracteres).");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: titulo.trim(), descricao: descricao.trim(), categoria, prioridade }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(typeof d.erro === "string" ? d.erro : "Falha ao abrir o chamado.");
      }
      setTitulo("");
      setDescricao("");
      setCategoria("outro");
      setPrioridade("media");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao abrir o chamado.");
    } finally {
      setEnviando(false);
    }
  }

  // Exclusão definitiva — só o gestor (o botão nem aparece para o colaborador). Serve
  // para limpar chamados de teste/QA; chamado real resolvido fica como histórico.
  async function excluir(id: string) {
    if (!window.confirm("Excluir DEFINITIVAMENTE este chamado? Esta ação não tem volta.")) return;
    setErro(null);
    try {
      const r = await fetch(`/api/chamados/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(typeof d.erro === "string" ? d.erro : "Falha ao excluir o chamado.");
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir o chamado.");
    }
  }

  async function atualizar(id: string, patch: { status?: StatusChamado; respostaGestor?: string | null }) {
    setErro(null);
    try {
      const r = await fetch(`/api/chamados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(typeof d.erro === "string" ? d.erro : "Falha ao atualizar o chamado.");
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar o chamado.");
    }
  }

  return (
    <div style={{ padding: "28px", maxWidth: "880px" }}>
      {/* Hero */}
      <div
        style={{
          borderRadius: "18px",
          padding: "26px 30px",
          marginBottom: "20px",
          background: "linear-gradient(135deg,var(--blue-700),var(--blue-500))",
          color: "white",
        }}
      >
        <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-.5px", margin: 0 }}>Chamados</h2>
        <div style={{ fontSize: "13.5px", opacity: 0.9, marginTop: "6px", lineHeight: 1.5 }}>
          Reporte um problema ou abra um chamado. {souGestor ? "Como gestor, você vê e resolve os chamados de toda a equipe." : "Tudo é enviado para o gestor, que acompanha e responde."}
        </div>
      </div>

      {/* Form: abrir chamado */}
      <form
        onSubmit={abrir}
        style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", marginBottom: "22px", boxShadow: "var(--shadow-sm)" }}
      >
        <div style={{ display: "grid", gap: "12px" }}>
          <input style={inputStyle} placeholder="Título do chamado (ex.: PDF não gera no Chrome)" value={titulo} maxLength={140} onChange={(e) => setTitulo(e.target.value)} />
          <textarea
            style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
            placeholder="Descreva o problema: o que aconteceu, onde, e o que você esperava."
            value={descricao}
            maxLength={4000}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: "180px", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>
              Categoria
              <select style={{ ...inputStyle, marginTop: "5px" }} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaChamado)}>
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: "180px", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>
              Prioridade
              <select style={{ ...inputStyle, marginTop: "5px" }} value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeChamado)}>
                {PRIORIDADES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={enviando}
            style={{
              justifySelf: "start",
              padding: "11px 22px",
              background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))",
              border: "none",
              borderRadius: "10px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 700,
              color: "white",
              opacity: enviando ? 0.6 : 1,
            }}
          >
            {enviando ? "Enviando…" : "Abrir chamado"}
          </button>
        </div>
      </form>

      {erro && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "12px", padding: "12px 14px", fontSize: "13px", marginBottom: "16px" }}>
          {erro}
        </div>
      )}

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px" }}>
          {souGestor ? "Todos os chamados" : "Meus chamados"} · {chamados.length}
        </div>
        {carregando && <div style={{ color: "var(--gray-500)", fontSize: "14px" }}>Carregando…</div>}
        {!carregando && chamados.length === 0 && (
          <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>Nenhum chamado ainda.</div>
        )}
        {chamados.map((c) => (
          <CardChamado key={c.id} chamado={c} souGestor={souGestor} onAtualizar={atualizar} onExcluir={excluir} />
        ))}
      </div>
    </div>
  );
}

function CardChamado({
  chamado: c,
  souGestor,
  onAtualizar,
  onExcluir,
}: {
  chamado: Chamado;
  souGestor: boolean;
  onAtualizar: (id: string, patch: { status?: StatusChamado; respostaGestor?: string | null }) => void;
  onExcluir: (id: string) => void;
}) {
  const [resposta, setResposta] = useState(c.respostaGestor ?? "");
  const st = STATUS_INFO[c.status];
  const data = new Date(c.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
        <span style={{ fontWeight: 700, fontSize: "12px", padding: "3px 9px", borderRadius: "999px", color: st.cor, background: st.bg }}>{st.label}</span>
        <span style={{ fontSize: "11.5px", fontWeight: 700, color: PRIO_COR[c.prioridade], textTransform: "uppercase" }}>{c.prioridade}</span>
        <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>· {rotuloCategoria(c.categoria)}</span>
        <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--gray-400)" }}>{autorLabel(c)} · {data}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--gray-900)" }}>{c.titulo}</div>
      <div style={{ fontSize: "13.5px", color: "var(--gray-700)", marginTop: "4px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.descricao}</div>

      {c.respostaGestor && !souGestor && (
        <div style={{ marginTop: "10px", background: "var(--gray-50)", borderLeft: "3px solid var(--blue-500)", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", color: "var(--gray-700)" }}>
          <b style={{ color: "var(--blue-700)" }}>Gestor:</b> {c.respostaGestor}
        </div>
      )}

      {souGestor && (
        <div style={{ marginTop: "12px", borderTop: "1px dashed var(--gray-200)", paddingTop: "12px", display: "grid", gap: "8px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              onClick={() => onExcluir(c.id)}
              style={{
                order: 1,
                marginLeft: "auto",
                padding: "5px 11px",
                borderRadius: "999px",
                border: "1px solid #fecaca",
                background: "white",
                color: "#b91c1c",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                flex: "none",
              }}
            >
              Excluir
            </button>
            {STATUS_FLUXO.map((s) => {
              const ativo = c.status === s;
              return (
                <button
                  key={s}
                  onClick={() => !ativo && onAtualizar(c.id, { status: s })}
                  style={{
                    padding: "5px 11px",
                    borderRadius: "999px",
                    border: `1px solid ${ativo ? STATUS_INFO[s].cor : "var(--gray-200)"}`,
                    background: ativo ? STATUS_INFO[s].bg : "white",
                    color: ativo ? STATUS_INFO[s].cor : "var(--gray-500)",
                    fontSize: "12px",
                    fontWeight: ativo ? 700 : 500,
                    cursor: ativo ? "default" : "pointer",
                  }}
                >
                  {STATUS_INFO[s].label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <textarea
              style={{ ...inputStyle, minHeight: "40px", resize: "vertical", fontSize: "13px" }}
              placeholder="Resposta ao colaborador…"
              value={resposta}
              maxLength={4000}
              onChange={(e) => setResposta(e.target.value)}
            />
            <button
              onClick={() => onAtualizar(c.id, { respostaGestor: resposta.trim() || null })}
              disabled={resposta === (c.respostaGestor ?? "")}
              style={{
                padding: "9px 14px",
                background: resposta === (c.respostaGestor ?? "") ? "var(--gray-200)" : "var(--blue-600)",
                color: "white",
                border: "none",
                borderRadius: "9px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: resposta === (c.respostaGestor ?? "") ? "default" : "pointer",
                flex: "none",
              }}
            >
              Responder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
