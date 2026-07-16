"use client";

import { useEffect, useState } from "react";

type Contato = { cliente: string; email: string; atualizadoEm: string };
type Colaborador = { nome: string; email: string; papel: "admin" | "user"; telefone: string | null };

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

  async function carregar() {
    setErro(null);
    try {
      const [cfg, ct, cl] = await Promise.all([fetch("/api/admin-config"), fetch("/api/contatos"), fetch("/api/colaboradores")]);
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
  useEffect(() => {
    carregar();
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

  if (semAcesso) {
    return (
      <div style={{ padding: "28px", maxWidth: "560px", color: "var(--gray-500)" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>Painel de administração</h2>
        <p style={{ marginTop: "8px" }}>Só o gestor (perfil admin) acessa este painel.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px", maxWidth: "760px" }}>
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

      {/* Colaboradores (telefone) */}
      <section style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", marginTop: "22px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", margin: "0 0 4px" }}>Colaboradores · {colaboradores.length}</h3>
        <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBottom: "12px" }}>
          Telefone de cada colaborador. Cada um também pode editar o próprio em &quot;Meu perfil&quot;.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {colaboradores.length === 0 && <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Nenhum colaborador cadastrado ainda.</div>}
          {colaboradores.map((c) => (
            <LinhaColaborador key={c.email} colaborador={c} onSalvar={salvarTelefoneColaborador} />
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
}: {
  colaborador: Colaborador;
  onSalvar: (email: string, telefone: string) => void;
}) {
  const [telefone, setTelefone] = useState(colaborador.telefone ?? "");
  const mudou = telefone.trim() !== (colaborador.telefone ?? "");
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 10px", borderRadius: "9px", background: "var(--gray-50)" }}>
      <div style={{ flex: 1.4, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{colaborador.nome}</div>
        <div style={{ fontSize: "11.5px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{colaborador.email} · {colaborador.papel === "admin" ? "Administrador" : "Vendedor"}</div>
      </div>
      <input style={{ ...inputStyle, flex: 1, minWidth: "140px", padding: "6px 10px", fontSize: "13px" }} placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      <button style={btn("var(--blue-600)", mudou)} onClick={() => mudou && onSalvar(colaborador.email, telefone.trim())}>Salvar</button>
    </div>
  );
}
