"use client";

import { useEffect, useState } from "react";

type Contato = { cliente: string; email: string; atualizadoEm: string };
type Acesso = "pendente" | "aprovado" | "bloqueado";
type Colaborador = { nome: string; email: string; papel: "admin" | "user"; acesso: Acesso; telefone: string | null; criadoEm: string };

const ACESSO_UI: Record<Acesso, { label: string; bg: string; fg: string }> = {
  pendente: { label: "Aguardando", bg: "#FEF3C7", fg: "#B45309" },
  aprovado: { label: "Liberado", bg: "#DCFCE7", fg: "#16A34A" },
  bloqueado: { label: "Sem acesso", bg: "#FEE2E2", fg: "#DC2626" },
};

const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const inputStyle = {
  padding: "9px 12px",
  border: "1px solid var(--gray-200)",
  borderRadius: "9px",
  fontSize: "14px",
  fontFamily: "'Inter',sans-serif",
  color: "var(--gray-900)",
  background: "white",
  outline: "none",
} as const;

const btn = (cor: string, on = true) =>
  ({
    padding: "9px 14px",
    background: on ? cor : "var(--gray-200)",
    color: "white",
    border: "none",
    borderRadius: "9px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: on ? "pointer" : "default",
    flex: "none",
    // Rótulo em uma linha só: os botões da lista do Time têm largura fixa (para as colunas
    // alinharem entre as linhas) e "Tornar vendedor" quebraria em duas linhas sem isso.
    whiteSpace: "nowrap",
  }) as const;

export function AdminScreen() {
  const [gestorEmail, setGestorEmail] = useState("");
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);

  const [novoCliente, setNovoCliente] = useState("");
  const [novoEmail, setNovoEmail] = useState("");

  // O `setErro(null)` fica DEPOIS do await de propósito: no mount esta função roda dentro de
  // um effect, e setState síncrono ali encadeia render extra (React 19 acusa). Limpar o erro
  // só quando o carregamento dá certo também evita a mensagem piscar a cada recarga.
  async function carregar() {
    try {
      const [cfg, ct, cl] = await Promise.all([fetch("/api/admin-config"), fetch("/api/contatos"), fetch("/api/colaboradores")]);
      setErro(null);
      if (cfg.status === 403 || ct.status === 403 || cl.status === 403) {
        setSemAcesso(true);
        return;
      }
      const c = await cfg.json();
      const l = await ct.json();
      const co = await cl.json();
      setGestorEmail(c.gestorEmail ?? "");
      setContatos(l.contatos ?? []);
      setColaboradores(co.colaboradores ?? []);
    } catch {
      setErro("Falha ao carregar o painel.");
    }
  }
  // Carrega no mount por callback de promise — ver chamados-screen.tsx: chamada direta faria
  // setState síncrono dentro do effect, encadeando render extra.
  useEffect(() => {
    void Promise.resolve().then(carregar);
  }, []);

  async function salvarGestor() {
    setErro(null);
    setAviso(null);
    const r = await fetch("/api/admin-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gestorEmail }),
    });
    if (r.ok) setAviso("E-mail do gestor salvo.");
    else setErro((await r.json()).erro ?? "Falha ao salvar.");
  }

  async function salvarContato(cliente: string, email: string) {
    setErro(null);
    const r = await fetch("/api/contatos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente, email }),
    });
    if (!r.ok) {
      setErro((await r.json()).erro ?? "Falha ao salvar contato.");
      return;
    }
    setNovoCliente("");
    setNovoEmail("");
    await carregar();
  }

  async function remover(cliente: string) {
    await fetch(`/api/contatos?cliente=${encodeURIComponent(cliente)}`, { method: "DELETE" });
    await carregar();
  }

  async function salvarTelefoneColaborador(email: string, telefone: string) {
    setErro(null);
    const r = await fetch("/api/colaboradores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, telefone: telefone || null }),
    });
    if (!r.ok) {
      setErro((await r.json()).erro ?? "Falha ao salvar telefone.");
      return;
    }
    await carregar();
  }

  // Aprovar/revogar/promover: tudo é o mesmo PATCH. O servidor recusa o gestor mexer no
  // próprio acesso ou papel (409) — a mensagem dele vale mais que uma genérica daqui.
  async function mudarAcessoOuPapel(email: string, dados: { acesso?: Acesso; papel?: "admin" | "user" }, feito: string) {
    setErro(null);
    setAviso(null);
    const r = await fetch("/api/colaboradores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...dados }),
    });
    if (!r.ok) {
      setErro((await r.json().catch(() => ({}))).erro ?? "Falha ao atualizar o acesso.");
      return;
    }
    setAviso(feito);
    await carregar();
  }

  const pendentes = colaboradores.filter((c) => c.acesso === "pendente");
  const demais = colaboradores.filter((c) => c.acesso !== "pendente");

  if (semAcesso) {
    return (
      <div style={{ padding: "28px", maxWidth: "560px", color: "var(--gray-500)" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>Painel de administração</h2>
        <p style={{ marginTop: "8px" }}>Só o gestor (perfil admin) acessa este painel.</p>
      </div>
    );
  }

  return (
    // 900px, não 760: com as colunas de controle do Time em largura fixa, 760 deixava ~164px
    // para nome + e-mail e truncava tudo ("João Guilherme Ma…", "· G…"). As demais seções só
    // ganham respiro.
    <div style={{ padding: "28px", maxWidth: "900px" }}>
      <div style={{ borderRadius: "18px", padding: "24px 28px", marginBottom: "20px", background: "linear-gradient(135deg,var(--blue-700),var(--blue-500))", color: "white" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-.5px", margin: 0 }}>Painel de administração</h2>
        <div style={{ fontSize: "13.5px", opacity: 0.9, marginTop: "6px" }}>E-mail do gestor e cadastro de e-mails dos clientes (usado na cobrança).</div>
      </div>

      {erro && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "12px", padding: "11px 14px", fontSize: "13px", marginBottom: "14px" }}>{erro}</div>}
      {aviso && <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", borderRadius: "12px", padding: "11px 14px", fontSize: "13px", marginBottom: "14px" }}>{aviso}</div>}

      {/* E-mail do gestor */}
      <section style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", marginBottom: "22px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", margin: "0 0 4px" }}>E-mail do gestor</h3>
        <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBottom: "12px" }}>Quem recebe o resumo dos disparos de cobrança.</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder="gestor@empresa.com" value={gestorEmail} onChange={(e) => setGestorEmail(e.target.value)} />
          <button style={btn("var(--blue-600)")} onClick={salvarGestor}>Salvar</button>
        </div>
      </section>

      {/* Cadastro de e-mails dos clientes */}
      <section style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", margin: "0 0 4px" }}>E-mails dos clientes · {contatos.length}</h3>
        <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBottom: "12px" }}>
          O sistema aprende sozinho com a coluna de e-mail das planilhas. Aqui você corrige ou adiciona manualmente.
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, flex: 2, minWidth: "160px" }} placeholder="Nome do cliente (igual à planilha)" value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)} />
          <input style={{ ...inputStyle, flex: 2, minWidth: "160px" }} type="email" placeholder="email@cliente.com" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} />
          <button style={btn("var(--orange-500)", !!novoCliente.trim() && !!novoEmail.trim())} onClick={() => novoCliente.trim() && novoEmail.trim() && salvarContato(novoCliente.trim(), novoEmail.trim())}>
            Adicionar
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {contatos.length === 0 && <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Nenhum e-mail cadastrado ainda.</div>}
          {contatos.map((c) => (
            <LinhaContato key={c.cliente} contato={c} onSalvar={salvarContato} onRemover={remover} />
          ))}
        </div>
      </section>

      {/* Fila de aprovação — quem se cadastrou e ainda não entrou */}
      <section
        style={{
          background: pendentes.length ? "#FFFBEB" : "white",
          border: `1px solid ${pendentes.length ? "#FCD34D" : "var(--gray-200)"}`,
          borderRadius: "16px", padding: "20px", marginTop: "22px",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", margin: "0 0 4px" }}>
          Aguardando liberação{pendentes.length > 0 && ` · ${pendentes.length}`}
        </h3>
        <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBottom: "12px" }}>
          Quem se cadastrou e ainda não consegue entrar. Só passa do login depois que você liberar.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {pendentes.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Ninguém na fila — todo cadastro já foi resolvido.</div>
          )}
          {pendentes.map((c) => (
            <div key={c.email} style={{ display: "flex", gap: "8px", alignItems: "center", padding: "9px 11px", borderRadius: "9px", background: "white", border: "1px solid #FDE68A" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</div>
                <div style={{ fontSize: "11.5px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.email} · cadastrou {dataCurta(c.criadoEm)}
                </div>
              </div>
              <button style={btn("var(--success)")} onClick={() => mudarAcessoOuPapel(c.email, { acesso: "aprovado" }, `${c.nome} agora tem acesso.`)}>
                Liberar
              </button>
              <button style={{ ...btn("#dc2626"), background: "white", color: "#dc2626", border: "1px solid #fecaca" }} onClick={() => mudarAcessoOuPapel(c.email, { acesso: "bloqueado" }, `Cadastro de ${c.nome} recusado.`)}>
                Recusar
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Time — papel, acesso e telefone de quem já foi resolvido */}
      <section style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", marginTop: "22px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", margin: "0 0 4px" }}>Time · {demais.length}</h3>
        <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBottom: "12px" }}>
          Quem entra, com que poder e o telefone. Gestor vê as propostas do time inteiro; vendedor vê só as dele.
          Revogar é reversível — a conta e as propostas continuam lá.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {demais.length === 0 && <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Nenhum colaborador cadastrado ainda.</div>}
          {demais.map((c) => (
            <LinhaColaborador
              key={c.email}
              colaborador={c}
              onSalvar={salvarTelefoneColaborador}
              onMudar={mudarAcessoOuPapel}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function LinhaContato({
  contato,
  onSalvar,
  onRemover,
}: {
  contato: Contato;
  onSalvar: (cliente: string, email: string) => void;
  onRemover: (cliente: string) => void;
}) {
  const [email, setEmail] = useState(contato.email);
  const mudou = email.trim() !== contato.email;
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 10px", borderRadius: "9px", background: "var(--gray-50)" }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contato.cliente}</span>
      <input style={{ ...inputStyle, flex: 1.4, minWidth: "140px", padding: "6px 10px", fontSize: "13px" }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button style={btn("var(--blue-600)", mudou)} onClick={() => mudou && onSalvar(contato.cliente, email.trim())}>Salvar</button>
      <button style={{ ...btn("#dc2626"), padding: "9px 11px" }} onClick={() => onRemover(contato.cliente)} title="Remover">✕</button>
    </div>
  );
}

function LinhaColaborador({
  colaborador,
  onSalvar,
  onMudar,
}: {
  colaborador: Colaborador;
  onSalvar: (email: string, telefone: string) => void;
  onMudar: (email: string, dados: { acesso?: Acesso; papel?: "admin" | "user" }, feito: string) => void;
}) {
  const [telefone, setTelefone] = useState(colaborador.telefone ?? "");
  const mudou = telefone.trim() !== (colaborador.telefone ?? "");
  const ui = ACESSO_UI[colaborador.acesso];
  const ehGestor = colaborador.papel === "admin";
  const liberado = colaborador.acesso === "aprovado";

  // Colunas de LARGURA FIXA nos controles. Antes cada linha era um flex livre e a largura
  // do botão de papel mudava com o texto ("Tornar vendedor" é maior que "Tornar gestor"):
  // o telefone e os botões de cada pessoa paravam num ponto diferente e a lista saía
  // serrilhada. Fixando as colunas, todas as linhas alinham independente do papel/acesso.
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", padding: "9px 11px", borderRadius: "9px", background: "var(--gray-50)" }}>
      <div style={{ flex: "1 1 190px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{colaborador.nome}</span>
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: ui.fg, background: ui.bg, borderRadius: "999px", padding: "2px 8px", flex: "none" }}>{ui.label}</span>
        </div>
        <div style={{ fontSize: "11.5px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {colaborador.email} · {ehGestor ? "Gestor" : "Vendedor"}
        </div>
      </div>

      <input style={{ ...inputStyle, width: "132px", flex: "none", padding: "6px 10px", fontSize: "13px" }} placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      <button style={{ ...btn("var(--blue-600)", mudou), width: "78px" }} disabled={!mudou} onClick={() => mudou && onSalvar(colaborador.email, telefone.trim())}>Salvar</button>

      <button
        style={{ ...btn("var(--blue-800)"), width: "142px", background: "white", color: "var(--blue-800)", border: "1px solid var(--gray-200)" }}
        title={ehGestor ? "Passa a ver só as próprias propostas" : "Passa a ver as propostas do time e este painel"}
        onClick={() =>
          onMudar(
            colaborador.email,
            { papel: ehGestor ? "user" : "admin" },
            ehGestor ? `${colaborador.nome} agora é vendedor.` : `${colaborador.nome} agora é gestor.`,
          )
        }
      >
        {ehGestor ? "Tornar vendedor" : "Tornar gestor"}
      </button>

      <button
        style={liberado
          ? { ...btn("#dc2626"), width: "96px", background: "white", color: "#dc2626", border: "1px solid #fecaca" }
          : { ...btn("var(--success)"), width: "96px" }}
        title={liberado ? "A conta e as propostas continuam; só o acesso é encerrado" : "Devolve o acesso"}
        onClick={() =>
          onMudar(
            colaborador.email,
            { acesso: liberado ? "bloqueado" : "aprovado" },
            liberado ? `Acesso de ${colaborador.nome} encerrado.` : `${colaborador.nome} voltou a ter acesso.`,
          )
        }
      >
        {liberado ? "Revogar" : "Liberar"}
      </button>
    </div>
  );
}
