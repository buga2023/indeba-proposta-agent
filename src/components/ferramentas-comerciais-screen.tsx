"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { RelatorioProspeccao, SolicitacaoComercial, TipoSolicitacaoComercial } from "@/lib/contracts";
import {
  AbaVisitas,
  BlocoAnexos,
  BlocoExcluidos,
  BotaoExcluidos,
  CampoAnexos,
  enviarAnexos,
  inputStyle,
  labelStyle,
  cardStyle,
  botaoPrimario,
  botaoExcluir,
  botaoEditar,
  mensagemErro,
  fmtData,
  type AbaProps,
} from "@/components/ferramentas-tecnicas-screen";

/**
 * Ferramentas Comerciais (foto do bloco do Mateus, 21/08/2026, revisada pelos áudios de
 * 25/08/2026 — "onde tem relatório, você bota registro"), três abas:
 *  - Registro de Prospecções: anotação manual do vendedor (a prospecção por IA
 *    continua no módulo Visitas e Prospecção).
 *  - Registro de Visitas de Rotina: mesma aba das Ferramentas Técnicas, com area
 *    "comercial" — a foto lista o relatório nas duas partes.
 *  - Solicitações Comerciais: análise de água e/ou tecidos, visita do setor técnico,
 *    ou amostra para demonstrações; status pendente → atendida.
 *
 * Todo vendedor escreve; cada um vê só os próprios registros, o gestor vê todos (o
 * recorte é do servidor — aqui a tela só mostra o que a API devolve).
 */

type Aba = "prospeccoes" | "visitas" | "solicitacoes";

const TIPOS_SOLICITACAO: { value: TipoSolicitacaoComercial; label: string }[] = [
  { value: "analise_agua_tecidos", label: "Análise de água e/ou tecidos" },
  { value: "analise_produtos_quimicos", label: "Análise dos produtos químicos" },
  { value: "visita_setor_tecnico", label: "Visita do setor técnico" },
  { value: "amostra_demonstracao", label: "Amostra para demonstração" },
  { value: "outras", label: "Outras solicitações" },
];
const rotuloTipo = (v: string) => TIPOS_SOLICITACAO.find((t) => t.value === v)?.label ?? v;

export function FerramentasComerciaisScreen() {
  const [aba, setAba] = useState<Aba>("prospeccoes");
  const [souGestor, setSouGestor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div style={{ padding: "28px", maxWidth: "980px" }}>
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
        <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-.5px", margin: 0 }}>Ferramentas Comerciais</h2>
        <div style={{ fontSize: "13.5px", opacity: 0.9, marginTop: "6px", lineHeight: 1.5 }}>
          Registro de prospecções, registro de visitas de rotina e solicitações comerciais.{" "}
          {souGestor ? "Como gestor, você vê os registros de toda a equipe." : "Você vê apenas os seus registros."}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "18px" }}>
        {(
          [
            // "Registro", não "Relatório" — áudio do Mateus, 25/08/2026.
            { key: "prospeccoes", label: "Registro de Prospecções" },
            { key: "visitas", label: "Registro de Visitas de Rotina" },
            { key: "solicitacoes", label: "Solicitações Comerciais" },
          ] as { key: Aba; label: string }[]
        ).map((t) => {
          const ativo = aba === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setAba(t.key);
                setErro(null);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                border: `1px solid ${ativo ? "var(--blue-600)" : "var(--gray-200)"}`,
                background: ativo ? "var(--blue-600)" : "white",
                color: ativo ? "white" : "var(--gray-500)",
                fontSize: "13px",
                fontWeight: ativo ? 700 : 500,
                cursor: ativo ? "default" : "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {erro && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "12px", padding: "12px 14px", fontSize: "13px", marginBottom: "16px" }}>
          {erro}
        </div>
      )}

      {aba === "prospeccoes" && <AbaProspeccoes setErro={setErro} setSouGestor={setSouGestor} souGestor={souGestor} />}
      {aba === "visitas" && <AbaVisitas area="comercial" setErro={setErro} setSouGestor={setSouGestor} souGestor={souGestor} />}
      {aba === "solicitacoes" && <AbaSolicitacoes setErro={setErro} setSouGestor={setSouGestor} souGestor={souGestor} />}
    </div>
  );
}

/* ═══════════ Aba 1 — Registro de Prospecções ═══════════ */

function AbaProspeccoes({ setErro, setSouGestor, souGestor }: AbaProps) {
  const [relatorios, setRelatorios] = useState<RelatorioProspeccao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const hoje = new Date();
  const [data, setData] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`,
  );
  const [horario, setHorario] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  // Anexos (áudio do Mateus, 27/08/2026): foto da fachada, cartão de quem foi visitado…
  const [fotosNovas, setFotosNovas] = useState<File[]>([]);
  const [documentosNovos, setDocumentosNovos] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);

  // Edição (áudio do Mateus, 25/08/2026): usuário e gestor editam; a data NÃO muda —
  // fica a da visita registrada (visita nova = registro novo).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ed, setEd] = useState({ horario: "", empresa: "", contato: "", telefone: "", observacao: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  // Aba Excluídos (áudio do Mateus, 25/08/2026): restaurar ou excluir definitivamente.
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/novas-prospeccoes");
      const d = await r.json();
      if (!r.ok) throw new Error(mensagemErro(d, "Falha ao carregar as prospecções."));
      setErro(null);
      setRelatorios(d.relatorios);
      setSouGestor(d.souGestor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as prospecções.");
    } finally {
      setCarregando(false);
    }
  }
  // Carrega por callback de promise — setState síncrono no corpo do effect encadeia
  // render extra (React 19 acusa); mesmo desenho de chamados-screen.tsx.
  useEffect(() => {
    void Promise.resolve().then(carregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lancar(e: FormEvent) {
    e.preventDefault();
    // "Com quem falou" é obrigatório (áudio do Mateus, 25/08/2026).
    if (!data || !horario || empresa.trim().length < 2 || contato.trim().length < 2) {
      setErro("Preencha a data, o horário, a empresa prospectada e com quem falou.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/novas-prospeccoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          horario,
          empresa: empresa.trim(),
          contato: contato.trim(),
          telefone: telefone.trim() || null,
          observacao: observacao.trim() || null,
        }),
      });
      const criado = await r.json();
      if (!r.ok) throw new Error(mensagemErro(criado, "Falha ao registrar a prospecção."));
      const falhas = await enviarAnexos("prospeccao", criado.id, fotosNovas, documentosNovos);
      if (falhas.length > 0) setErro(`Prospecção registrada, mas alguns anexos falharam: ${falhas.join(", ")}.`);
      setHorario("");
      setEmpresa("");
      setContato("");
      setTelefone("");
      setObservacao("");
      setFotosNovas([]);
      setDocumentosNovos([]);
      setInputKey((k) => k + 1);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar a prospecção.");
    } finally {
      setEnviando(false);
    }
  }

  function abrirEdicao(p: RelatorioProspeccao) {
    setEditandoId(p.id);
    setEd({
      horario: p.horario ?? "",
      empresa: p.empresa,
      contato: p.contato ?? "",
      telefone: p.telefone ?? "",
      observacao: p.observacao ?? "",
    });
    setErro(null);
  }

  async function salvarEdicao(id: string) {
    if (ed.empresa.trim().length < 2 || !ed.horario || ed.contato.trim().length < 2) {
      setErro("Informe a empresa prospectada, o horário e com quem falou.");
      return;
    }
    setSalvandoEdicao(true);
    setErro(null);
    try {
      const r = await fetch(`/api/novas-prospeccoes?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horario: ed.horario,
          empresa: ed.empresa.trim(),
          contato: ed.contato.trim(),
          telefone: ed.telefone.trim() || null,
          observacao: ed.observacao.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao editar a prospecção."));
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao editar a prospecção.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  // Excluir é só do gestor — o botão nem aparece para o vendedor (áudio do Mateus,
  // 25/08/2026: o usuário só edita).
  async function excluir(id: string) {
    if (!window.confirm("Excluir este registro de prospecção?")) return;
    try {
      const r = await fetch(`/api/novas-prospeccoes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao excluir a prospecção."));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir a prospecção.");
    }
  }

  return (
    <>
      <form onSubmit={lancar} style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: "140px" }}>
              Data
              <input type="date" style={{ ...inputStyle, marginTop: "5px" }} value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: "120px" }}>
              Horário
              <input type="time" style={{ ...inputStyle, marginTop: "5px" }} value={horario} onChange={(e) => setHorario(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 2, minWidth: "200px" }}>
              Empresa prospectada
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Nome da empresa" maxLength={200} value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </label>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 2, minWidth: "180px" }}>
              Contato
              {/* Sem "(opcional)" no texto — áudio do Mateus, 25/08/2026: não travar o
                  registro, mas também não convidar a deixar em branco. */}
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Com quem falou" maxLength={200} value={contato} onChange={(e) => setContato(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: "150px" }}>
              Telefone
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="(00) 00000-0000" maxLength={30} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </label>
          </div>
          <label style={labelStyle}>
            Observação
            <textarea
              style={{ ...inputStyle, marginTop: "5px", minHeight: "70px", resize: "vertical" }}
              placeholder="Como foi a prospecção, próximos passos…"
              maxLength={4000}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>
          <CampoAnexos fotos={fotosNovas} setFotos={setFotosNovas} documentos={documentosNovos} setDocumentos={setDocumentosNovos} inputKey={inputKey} />
          <button type="submit" disabled={enviando} style={botaoPrimario(enviando)}>
            {enviando ? "Registrando…" : "Registrar prospecção"}
          </button>
        </div>
      </form>

      {mostrarExcluidos && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <BotaoExcluidos ativo onClick={() => setMostrarExcluidos(false)} />
          </div>
          <BlocoExcluidos<RelatorioProspeccao>
            endpoint="/api/novas-prospeccoes"
            chave="relatorios"
            setErro={setErro}
            aoMudar={carregar}
            render={(p) => (
              <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>
                <b>{fmtData(p.data)}{p.horario ? ` às ${p.horario}` : ""}</b> · {p.empresa}
                {souGestor ? ` · ${p.autorNome ?? p.autor}` : ""}
              </span>
            )}
          />
        </div>
      )}
      {!mostrarExcluidos && (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px" }}>
            {souGestor ? "Todas as prospecções" : "Minhas prospecções"} · {relatorios.length}
          </div>
          {souGestor && <BotaoExcluidos ativo={false} onClick={() => setMostrarExcluidos(true)} />}
        </div>
        {carregando && <div style={{ color: "var(--gray-500)", fontSize: "14px" }}>Carregando…</div>}
        {!carregando && relatorios.length === 0 && (
          <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>Nenhuma prospecção registrada ainda.</div>
        )}
        {relatorios.map((p) => {
          const emEdicao = editandoId === p.id;
          return (
            <div key={p.id} style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>
                  {fmtData(p.data)}
                  {p.horario ? ` às ${p.horario}` : ""}
                </span>
                <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>· {p.empresa}</span>
                {souGestor && <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>· {p.autorNome ?? p.autor}</span>}
                {!emEdicao && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                    <button onClick={() => abrirEdicao(p)} style={botaoEditar}>
                      Editar
                    </button>
                    {/* Excluir é só do gestor — o vendedor só edita (áudio 25/08/2026). */}
                    {souGestor && (
                      <button onClick={() => excluir(p.id)} style={botaoExcluir}>
                        Excluir
                      </button>
                    )}
                  </div>
                )}
              </div>
              {emEdicao ? (
                <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                  <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                    A data não muda na edição — visita nova é um registro novo.
                  </div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <label style={{ ...labelStyle, flex: 1, minWidth: "110px" }}>
                      Horário
                      <input type="time" style={{ ...inputStyle, marginTop: "5px" }} value={ed.horario} onChange={(e) => setEd({ ...ed, horario: e.target.value })} />
                    </label>
                    <label style={{ ...labelStyle, flex: 2, minWidth: "180px" }}>
                      Empresa prospectada
                      <input style={{ ...inputStyle, marginTop: "5px" }} maxLength={200} value={ed.empresa} onChange={(e) => setEd({ ...ed, empresa: e.target.value })} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <label style={{ ...labelStyle, flex: 2, minWidth: "160px" }}>
                      Contato
                      <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Com quem falou" maxLength={200} value={ed.contato} onChange={(e) => setEd({ ...ed, contato: e.target.value })} />
                    </label>
                    <label style={{ ...labelStyle, flex: 1, minWidth: "140px" }}>
                      Telefone
                      <input style={{ ...inputStyle, marginTop: "5px" }} maxLength={30} value={ed.telefone} onChange={(e) => setEd({ ...ed, telefone: e.target.value })} />
                    </label>
                  </div>
                  <label style={labelStyle}>
                    Observação
                    <textarea
                      style={{ ...inputStyle, marginTop: "5px", minHeight: "70px", resize: "vertical" }}
                      placeholder="Como foi a prospecção, próximos passos…"
                      maxLength={4000}
                      value={ed.observacao}
                      onChange={(e) => setEd({ ...ed, observacao: e.target.value })}
                    />
                  </label>
                  <BlocoAnexos tipo="prospeccao" registroId={p.id} anexos={p.anexos} editavel aoMudar={carregar} setErro={setErro} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => salvarEdicao(p.id)} disabled={salvandoEdicao} style={botaoPrimario(salvandoEdicao)}>
                      {salvandoEdicao ? "Salvando…" : "Salvar edição"}
                    </button>
                    <button
                      onClick={() => setEditandoId(null)}
                      style={{ ...botaoEditar, borderColor: "var(--gray-200)", color: "var(--gray-500)", padding: "11px 18px", borderRadius: "10px" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(p.contato || p.telefone) && (
                    <div style={{ fontSize: "13px", color: "var(--gray-700)", marginTop: "6px" }}>
                      {p.contato && (
                        <>
                          Contato: <b>{p.contato}</b>
                        </>
                      )}
                      {p.telefone ? `${p.contato ? " · " : ""}Tel: ${p.telefone}` : ""}
                    </div>
                  )}
                  {p.observacao && (
                    <div style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "4px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{p.observacao}</div>
                  )}
                  <BlocoAnexos tipo="prospeccao" registroId={p.id} anexos={p.anexos} editavel={false} aoMudar={carregar} setErro={setErro} />
                </>
              )}
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}

/* ═══════════ Aba 3 — Solicitações Comerciais ═══════════ */

function AbaSolicitacoes({ setErro, setSouGestor, souGestor }: AbaProps) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoComercial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [tipo, setTipo] = useState<TipoSolicitacaoComercial>("analise_agua_tecidos");
  const [cliente, setCliente] = useState("");
  const [observacao, setObservacao] = useState("");
  // Anexos (áudio do Mateus, 27/08/2026): mesma opção de foto e documento das visitas.
  const [fotosNovas, setFotosNovas] = useState<File[]>([]);
  const [documentosNovos, setDocumentosNovos] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);

  // Edição (áudio do Mateus, 25/08/2026: "editar para a parte deles") + aba Excluídos.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ed, setEd] = useState({ tipo: "analise_agua_tecidos" as TipoSolicitacaoComercial, cliente: "", observacao: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/solicitacoes-comerciais");
      const d = await r.json();
      if (!r.ok) throw new Error(mensagemErro(d, "Falha ao carregar as solicitações."));
      setErro(null);
      setSolicitacoes(d.solicitacoes);
      setSouGestor(d.souGestor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as solicitações.");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(carregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    if (cliente.trim().length < 2) {
      setErro("Informe o cliente da solicitação.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/solicitacoes-comerciais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, cliente: cliente.trim(), observacao: observacao.trim() || null }),
      });
      const criada = await r.json();
      if (!r.ok) throw new Error(mensagemErro(criada, "Falha ao abrir a solicitação."));
      const falhas = await enviarAnexos("solicitacao", criada.id, fotosNovas, documentosNovos);
      if (falhas.length > 0) setErro(`Solicitação aberta, mas alguns anexos falharam: ${falhas.join(", ")}.`);
      setCliente("");
      setObservacao("");
      setTipo("analise_agua_tecidos");
      setFotosNovas([]);
      setDocumentosNovos([]);
      setInputKey((k) => k + 1);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao abrir a solicitação.");
    } finally {
      setEnviando(false);
    }
  }

  async function marcar(id: string, status: "pendente" | "atendida") {
    try {
      const r = await fetch(`/api/solicitacoes-comerciais?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao atualizar a solicitação."));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar a solicitação.");
    }
  }

  async function salvarEdicao(id: string) {
    if (ed.cliente.trim().length < 2) {
      setErro("Informe o cliente da solicitação.");
      return;
    }
    setSalvandoEdicao(true);
    setErro(null);
    try {
      const r = await fetch(`/api/solicitacoes-comerciais?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: ed.tipo, cliente: ed.cliente.trim(), observacao: ed.observacao.trim() || null }),
      });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao editar a solicitação."));
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao editar a solicitação.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  // Excluir é só do gestor; a solicitação vai para a aba Excluídos (restaurável).
  async function excluir(id: string) {
    if (!window.confirm("Excluir esta solicitação? Ela vai para a aba Excluídos.")) return;
    try {
      const r = await fetch(`/api/solicitacoes-comerciais?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao excluir a solicitação."));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir a solicitação.");
    }
  }

  return (
    <>
      <form onSubmit={abrir} style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: "220px" }}>
              Tipo da solicitação
              <select style={{ ...inputStyle, marginTop: "5px" }} value={tipo} onChange={(e) => setTipo(e.target.value as TipoSolicitacaoComercial)}>
                {TIPOS_SOLICITACAO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...labelStyle, flex: 2, minWidth: "200px" }}>
              Cliente
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Para qual cliente" maxLength={200} value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </label>
          </div>
          <label style={labelStyle}>
            Observação
            <textarea
              style={{ ...inputStyle, marginTop: "5px", minHeight: "70px", resize: "vertical" }}
              placeholder="Detalhe o que precisa (o que analisar, o que demonstrar…)"
              maxLength={4000}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>
          <CampoAnexos fotos={fotosNovas} setFotos={setFotosNovas} documentos={documentosNovos} setDocumentos={setDocumentosNovos} inputKey={inputKey} />
          <button type="submit" disabled={enviando} style={botaoPrimario(enviando)}>
            {enviando ? "Enviando…" : "Abrir solicitação"}
          </button>
        </div>
      </form>

      {mostrarExcluidos && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <BotaoExcluidos ativo onClick={() => setMostrarExcluidos(false)} />
          </div>
          <BlocoExcluidos<SolicitacaoComercial>
            endpoint="/api/solicitacoes-comerciais"
            chave="solicitacoes"
            setErro={setErro}
            aoMudar={carregar}
            render={(s) => (
              <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>
                <b>{rotuloTipo(s.tipo)}</b> · {s.cliente} · {new Date(s.criadoEm).toLocaleDateString("pt-BR")}
                {souGestor ? ` · ${s.autorNome ?? s.autor}` : ""}
              </span>
            )}
          />
        </div>
      )}
      {!mostrarExcluidos && (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px" }}>
            {souGestor ? "Todas as solicitações" : "Minhas solicitações"} · {solicitacoes.length}
          </div>
          {souGestor && <BotaoExcluidos ativo={false} onClick={() => setMostrarExcluidos(true)} />}
        </div>
        {carregando && <div style={{ color: "var(--gray-500)", fontSize: "14px" }}>Carregando…</div>}
        {!carregando && solicitacoes.length === 0 && (
          <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>Nenhuma solicitação ainda.</div>
        )}
        {solicitacoes.map((s) => {
          const atendida = s.status === "atendida";
          return (
            <div key={s.id} style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "12px",
                    padding: "3px 9px",
                    borderRadius: "999px",
                    color: atendida ? "#15803d" : "#b45309",
                    background: atendida ? "#dcfce7" : "#fef3c7",
                  }}
                >
                  {atendida ? "Atendida" : "Pendente"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>{rotuloTipo(s.tipo)}</span>
                <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>· {s.cliente}</span>
                {souGestor && <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>· {s.autorNome ?? s.autor}</span>}
                <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>· {new Date(s.criadoEm).toLocaleDateString("pt-BR")}</span>
                {editandoId !== s.id && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                    <button onClick={() => marcar(s.id, atendida ? "pendente" : "atendida")} style={botaoEditar}>
                      {atendida ? "Reabrir" : "Marcar atendida"}
                    </button>
                    <button
                      onClick={() => {
                        setEditandoId(s.id);
                        setEd({ tipo: s.tipo, cliente: s.cliente, observacao: s.observacao ?? "" });
                        setErro(null);
                      }}
                      style={botaoEditar}
                    >
                      Editar
                    </button>
                    {/* Excluir é só do gestor — o vendedor só edita (áudio 25/08/2026). */}
                    {souGestor && (
                      <button onClick={() => excluir(s.id)} style={botaoExcluir}>
                        Excluir
                      </button>
                    )}
                  </div>
                )}
              </div>
              {editandoId === s.id ? (
                <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <label style={{ ...labelStyle, flex: 1, minWidth: "220px" }}>
                      Tipo da solicitação
                      <select style={{ ...inputStyle, marginTop: "5px" }} value={ed.tipo} onChange={(e) => setEd({ ...ed, tipo: e.target.value as TipoSolicitacaoComercial })}>
                        {TIPOS_SOLICITACAO.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ ...labelStyle, flex: 2, minWidth: "200px" }}>
                      Cliente
                      <input style={{ ...inputStyle, marginTop: "5px" }} maxLength={200} value={ed.cliente} onChange={(e) => setEd({ ...ed, cliente: e.target.value })} />
                    </label>
                  </div>
                  <label style={labelStyle}>
                    Observação
                    <textarea
                      style={{ ...inputStyle, marginTop: "5px", minHeight: "70px", resize: "vertical" }}
                      maxLength={4000}
                      value={ed.observacao}
                      onChange={(e) => setEd({ ...ed, observacao: e.target.value })}
                    />
                  </label>
                  <BlocoAnexos tipo="solicitacao" registroId={s.id} anexos={s.anexos} editavel aoMudar={carregar} setErro={setErro} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => salvarEdicao(s.id)} disabled={salvandoEdicao} style={botaoPrimario(salvandoEdicao)}>
                      {salvandoEdicao ? "Salvando…" : "Salvar edição"}
                    </button>
                    <button
                      onClick={() => setEditandoId(null)}
                      style={{ ...botaoEditar, borderColor: "var(--gray-200)", color: "var(--gray-500)", padding: "11px 18px", borderRadius: "10px" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {s.observacao && (
                    <div style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{s.observacao}</div>
                  )}
                  <BlocoAnexos tipo="solicitacao" registroId={s.id} anexos={s.anexos} editavel={false} aoMudar={carregar} setErro={setErro} />
                </>
              )}
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}
