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

  async function salvarDadosColaborador(email: string, dados: { nome?: string; telefone?: string }) {
    setErro(null);
    const r = await fetch("/api/colaboradores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...(dados.nome ? { nome: dados.nome } : {}), ...(dados.telefone !== undefined ? { telefone: dados.telefone || null } : {}) }),
    });
    if (!r.ok) {
      setErro((await r.json()).erro ?? "Falha ao salvar.");
      return;
    }
    await carregar();
  }

  // Criação de login pelo gestor (pedido do Matheus, ago/2026): nome + e-mail + telefone +
  // senha, conta já liberada — quem cria é quem liberaria.
  const [novoColab, setNovoColab] = useState({ nome: "", email: "", telefone: "", senha: "" });
  const novoColabOk = novoColab.nome.trim().length >= 2 && novoColab.email.includes("@") && novoColab.senha.length >= 8;
  async function criarLogin() {
    setErro(null);
    setAviso(null);
    const r = await fetch("/api/colaboradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoColab.nome.trim(),
        email: novoColab.email.trim(),
        senha: novoColab.senha,
        telefone: novoColab.telefone.trim() || null,
      }),
    });
    if (!r.ok) {
      setErro((await r.json().catch(() => ({}))).erro ?? "Falha ao criar o login.");
      return;
    }
    setAviso(`Login de ${novoColab.nome.trim()} criado — já pode entrar.`);
    setNovoColab({ nome: "", email: "", telefone: "", senha: "" });
    await carregar();
  }

  // A senha nova vem do campo inline da linha (a LinhaColaborador só chama com ≥8 chars).
  async function redefinirSenha(c: Colaborador, senha: string) {
    setErro(null);
    const r = await fetch("/api/colaboradores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, senha }),
    });
    if (!r.ok) {
      setErro((await r.json().catch(() => ({}))).erro ?? "Falha ao redefinir a senha.");
      return;
    }
    setAviso(`Senha de ${c.nome} redefinida.`);
  }

  async function removerColaborador(c: Colaborador) {
    if (!window.confirm(`Remover a conta de ${c.nome} (${c.email})?\n\nA exclusão é definitiva; as propostas dele ficam no histórico.`)) return;
    setErro(null);
    const r = await fetch(`/api/colaboradores?email=${encodeURIComponent(c.email)}`, { method: "DELETE" });
    if (!r.ok) {
      setErro((await r.json().catch(() => ({}))).erro ?? "Falha ao remover.");
      return;
    }
    setAviso(`Conta de ${c.nome} removida.`);
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

  // Busca local (nome/e-mail/telefone no Time; cliente/e-mail nos contatos): as listas
  // crescem com o uso e achar uma pessoa rolando a página inteira não escala.
  const [buscaTime, setBuscaTime] = useState("");
  const [buscaContato, setBuscaContato] = useState("");

  const pendentes = colaboradores.filter((c) => c.acesso === "pendente");
  const demais = colaboradores.filter((c) => c.acesso !== "pendente");
  const qTime = buscaTime.trim().toLowerCase();
  const timeFiltrado = qTime
    ? demais.filter((c) => `${c.nome} ${c.email} ${c.telefone ?? ""}`.toLowerCase().includes(qTime))
    : demais;
  const qContato = buscaContato.trim().toLowerCase();
  const contatosFiltrados = qContato
    ? contatos.filter((c) => `${c.cliente} ${c.email}`.toLowerCase().includes(qContato))
    : contatos;
  const gestores = colaboradores.filter((c) => c.papel === "admin").length;

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
        <div style={{ fontSize: "13.5px", opacity: 0.9, marginTop: "6px" }}>Logins e acessos do time, textos padrão da proposta e e-mails de clientes da cobrança.</div>
        {/* Números rápidos — o gestor vê o estado do painel sem rolar até cada seção. */}
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
          {[
            { n: demais.length, l: demais.length === 1 ? "conta no time" : "contas no time" },
            { n: pendentes.length, l: pendentes.length === 1 ? "aguardando liberação" : "aguardando liberação", alerta: pendentes.length > 0 },
            { n: gestores, l: gestores === 1 ? "gestor" : "gestores" },
            { n: contatos.length, l: contatos.length === 1 ? "e-mail de cliente" : "e-mails de clientes" },
          ].map((s, i) => (
            <span key={i} style={{ fontSize: "12.5px", fontWeight: 600, borderRadius: "999px", padding: "5px 12px", background: s.alerta ? "#FCD34D" : "rgba(255,255,255,.16)", color: s.alerta ? "#78350F" : "white" }}>
              <b style={{ fontWeight: 800 }}>{s.n}</b> {s.l}
            </span>
          ))}
        </div>
      </div>

      {erro && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "12px", padding: "11px 14px", fontSize: "13px", marginBottom: "14px" }}>
          <span style={{ flex: 1 }}>{erro}</span>
          <button onClick={() => setErro(null)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: "15px", lineHeight: 1, padding: "2px" }} title="Fechar">✕</button>
        </div>
      )}
      {aviso && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", borderRadius: "12px", padding: "11px 14px", fontSize: "13px", marginBottom: "14px" }}>
          <span style={{ flex: 1 }}>{aviso}</span>
          <button onClick={() => setAviso(null)} style={{ background: "none", border: "none", color: "#047857", cursor: "pointer", fontSize: "15px", lineHeight: 1, padding: "2px" }} title="Fechar">✕</button>
        </div>
      )}

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

        {/* Novo login direto pelo gestor — a conta nasce liberada, sem passar pela fila. */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, flex: "1 1 150px", minWidth: "130px" }} placeholder="Nome" value={novoColab.nome} onChange={(e) => setNovoColab({ ...novoColab, nome: e.target.value })} />
          <input style={{ ...inputStyle, flex: "1 1 180px", minWidth: "160px" }} type="email" placeholder="email@empresa.com" value={novoColab.email} onChange={(e) => setNovoColab({ ...novoColab, email: e.target.value })} />
          <input style={{ ...inputStyle, flex: "1 1 120px", minWidth: "110px" }} placeholder="Telefone" value={novoColab.telefone} onChange={(e) => setNovoColab({ ...novoColab, telefone: e.target.value })} />
          <input style={{ ...inputStyle, flex: "1 1 130px", minWidth: "120px" }} type="password" placeholder="Senha (mín. 8)" value={novoColab.senha} onChange={(e) => setNovoColab({ ...novoColab, senha: e.target.value })} />
          <button style={btn("var(--orange-500)", novoColabOk)} disabled={!novoColabOk} onClick={() => novoColabOk && criarLogin()}>
            Criar login
          </button>
        </div>

        {demais.length > 5 && (
          <input
            style={{ ...inputStyle, width: "100%", marginBottom: "10px" }}
            placeholder="Buscar por nome, e-mail ou telefone…"
            value={buscaTime}
            onChange={(e) => setBuscaTime(e.target.value)}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {demais.length === 0 && <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Nenhum colaborador cadastrado ainda.</div>}
          {demais.length > 0 && timeFiltrado.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Ninguém bate com “{buscaTime.trim()}”.</div>
          )}
          {timeFiltrado.map((c) => (
            <LinhaColaborador
              key={c.email}
              colaborador={c}
              onSalvar={salvarDadosColaborador}
              onMudar={mudarAcessoOuPapel}
              onSenha={redefinirSenha}
              onRemover={removerColaborador}
            />
          ))}
        </div>
      </section>

      {/* Textos padrão da proposta — editáveis sem programador (pedido do Matheus, ago/2026) */}
      <div style={{ marginTop: "22px" }}>
        <SecaoTextosPadrao onErro={setErro} onAviso={setAviso} />
      </div>

      {/* Cadastro de e-mails dos clientes */}
      <section style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", marginTop: "22px" }}>
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

        {contatos.length > 5 && (
          <input
            style={{ ...inputStyle, width: "100%", marginBottom: "10px" }}
            placeholder="Buscar cliente ou e-mail…"
            value={buscaContato}
            onChange={(e) => setBuscaContato(e.target.value)}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {contatos.length === 0 && <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Nenhum e-mail cadastrado ainda.</div>}
          {contatos.length > 0 && contatosFiltrados.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Nenhum cliente bate com “{buscaContato.trim()}”.</div>
          )}
          {contatosFiltrados.map((c) => (
            <LinhaContato key={c.cliente} contato={c} onSalvar={salvarContato} onRemover={remover} />
          ))}
        </div>
      </section>

      {/* E-mail do gestor — configuração da cobrança, por isso mora perto dos contatos. */}
      <section style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", marginTop: "22px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", margin: "0 0 4px" }}>E-mail do gestor</h3>
        <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBottom: "12px" }}>Quem recebe o resumo dos disparos de cobrança.</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder="gestor@empresa.com" value={gestorEmail} onChange={(e) => setGestorEmail(e.target.value)} />
          <button style={btn("var(--blue-600)")} onClick={salvarGestor}>Salvar</button>
        </div>
      </section>
    </div>
  );
}

type TextosPadrao = {
  capaSubtitulo?: string;
  apresentacao?: { saudacao: string; paragrafos: string[]; cards: { titulo: string; texto: string; icone: string }[] };
  comodatos?: { intro: string; equipamentos: { titulo: string; icone: string }[]; vantagens: string[] };
  condicoesConsolidada: { titulo: string; texto: string; icone: string }[];
  mensagemFechamento: string;
  condicoesComerciais: { validade: string; prazoEntrega: string; pagamento: string; frete: string };
};

// Rótulo de página da edição página-a-página (segue a ordem do documento gerado).
function TituloPagina({ numero, nome }: { numero: string; nome: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "16px 0 8px" }}>
      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "white", background: "var(--blue-700)", borderRadius: "999px", padding: "2px 9px", flex: "none" }}>{numero}</span>
      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".04em" }}>{nome}</span>
      <span style={{ flex: 1, height: "1px", background: "var(--gray-200)" }} />
    </div>
  );
}

// Condições comerciais e mensagem de fechamento que preenchem toda proposta NOVA.
// O que já foi salvo/enviado não muda — o texto assinado é o do documento gerado.
function SecaoTextosPadrao({ onErro, onAviso }: { onErro: (m: string | null) => void; onAviso: (m: string | null) => void }) {
  const [textos, setTextos] = useState<TextosPadrao | null>(null);
  const [fabrica, setFabrica] = useState<TextosPadrao | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void fetch("/api/textos-padrao")
      .then((r) => r.json())
      .then((d) => {
        if (d?.textos) setTextos(d.textos);
        if (d?.fabrica) setFabrica(d.fabrica);
      })
      .catch(() => onErro("Falha ao carregar os textos padrão."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    if (!textos) return;
    setSalvando(true);
    onErro(null);
    onAviso(null);
    // Linha em branco no textarea de lista (parágrafos/equipamentos/vantagens) é
    // rascunho de digitação, não item — sai antes de validar no servidor.
    const semVazios = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
    const limpo: TextosPadrao = {
      ...textos,
      apresentacao: textos.apresentacao && { ...textos.apresentacao, paragrafos: semVazios(textos.apresentacao.paragrafos) },
      comodatos: textos.comodatos && {
        ...textos.comodatos,
        equipamentos: textos.comodatos.equipamentos.filter((e) => e.titulo.trim()),
        vantagens: semVazios(textos.comodatos.vantagens),
      },
    };
    const r = await fetch("/api/textos-padrao", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textos: limpo }),
    });
    setSalvando(false);
    if (r.ok) onAviso("Textos padrão salvos — valem para as próximas propostas.");
    else onErro((await r.json().catch(() => ({}))).erro ?? "Falha ao salvar os textos.");
  }

  const rotulosComerciais: { k: keyof TextosPadrao["condicoesComerciais"]; label: string }[] = [
    { k: "validade", label: "Validade da proposta" },
    { k: "prazoEntrega", label: "Prazo de entrega" },
    { k: "pagamento", label: "Condições de pagamento" },
    { k: "frete", label: "Frete" },
  ];

  return (
    <section style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", marginBottom: "22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", margin: "0 0 4px" }}>Textos padrão da proposta</h3>
        {fabrica && (
          <button
            style={{ background: "none", border: "none", color: "var(--gray-500)", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
            onClick={() => setTextos(fabrica)}
          >
            Restaurar de fábrica
          </button>
        )}
      </div>
      <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBottom: "12px" }}>
        As condições comerciais que já vêm preenchidas em toda proposta nova (ex.: prazo do boleto). Propostas já geradas não mudam.
      </div>

      {!textos ? (
        <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>Carregando…</div>
      ) : (
        <>
          {/* ── Edição página a página, na ordem do documento (pedido do CEO, ago/2026) ── */}
          <TituloPagina numero="Pág. 1" nome="Capa" />
          <label style={{ display: "block", maxWidth: "420px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Subtítulo da capa</div>
            <input
              value={textos.capaSubtitulo ?? ""}
              onChange={(e) => setTextos((t) => t && { ...t, capaSubtitulo: e.target.value })}
              style={{ ...inputStyle, width: "100%", fontSize: "13px" }}
            />
          </label>

          {textos.apresentacao && (
            <>
              <TituloPagina numero="Pág. 2" nome="Apresentação" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px 16px" }}>
                <label style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Saudação</div>
                  <input
                    value={textos.apresentacao.saudacao}
                    onChange={(e) => setTextos((t) => t?.apresentacao ? { ...t, apresentacao: { ...t.apresentacao, saudacao: e.target.value } } : t)}
                    style={{ ...inputStyle, width: "100%", fontSize: "13px" }}
                  />
                </label>
                <label style={{ minWidth: 0, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Parágrafos (um por linha)</div>
                  <textarea
                    value={textos.apresentacao.paragrafos.join("\n")}
                    rows={5}
                    onChange={(e) =>
                      setTextos((t) => t?.apresentacao ? { ...t, apresentacao: { ...t.apresentacao, paragrafos: e.target.value.split("\n") } } : t)
                    }
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, fontSize: "13px" }}
                  />
                </label>
                {textos.apresentacao.cards.map((c, i) => (
                  <label key={i} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Card: {c.titulo}</div>
                    <textarea
                      value={c.texto}
                      rows={2}
                      onChange={(e) =>
                        setTextos((t) => t?.apresentacao ? { ...t, apresentacao: { ...t.apresentacao, cards: t.apresentacao.cards.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) } } : t)
                      }
                      style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, fontSize: "13px" }}
                    />
                  </label>
                ))}
              </div>
            </>
          )}

          {textos.comodatos && (
            <>
              <TituloPagina numero="Pág. 3" nome="Comodatos" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px 16px" }}>
                <label style={{ minWidth: 0, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Texto de abertura</div>
                  <textarea
                    value={textos.comodatos.intro}
                    rows={2}
                    onChange={(e) => setTextos((t) => t?.comodatos ? { ...t, comodatos: { ...t.comodatos, intro: e.target.value } } : t)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, fontSize: "13px" }}
                  />
                </label>
                <label style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Equipamentos (um por linha)</div>
                  <textarea
                    value={textos.comodatos.equipamentos.map((e) => e.titulo).join("\n")}
                    rows={4}
                    onChange={(e) =>
                      setTextos((t) => t?.comodatos ? {
                        ...t,
                        comodatos: {
                          ...t.comodatos,
                          equipamentos: e.target.value.split("\n").map((titulo, i) => ({ titulo, icone: t.comodatos!.equipamentos[i]?.icone ?? "check" })),
                        },
                      } : t)
                    }
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, fontSize: "13px" }}
                  />
                </label>
                <label style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Vantagens (uma por linha)</div>
                  <textarea
                    value={textos.comodatos.vantagens.join("\n")}
                    rows={4}
                    onChange={(e) => setTextos((t) => t?.comodatos ? { ...t, comodatos: { ...t.comodatos, vantagens: e.target.value.split("\n") } } : t)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, fontSize: "13px" }}
                  />
                </label>
              </div>
            </>
          )}

          <TituloPagina numero="Pág. 4+" nome="Páginas de produto" />
          <div style={{ fontSize: "12.5px", color: "var(--gray-500)" }}>
            O conteúdo das páginas de produto (nome, subtítulo, benefícios, ficha) vem do cadastro de produtos — edite lá.
          </div>

          <TituloPagina numero="Última" nome="Condições Comerciais" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px 16px", marginBottom: "14px" }}>
            {textos.condicoesConsolidada.map((c, i) => (
              <label key={i} style={{ minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>{c.titulo}</div>
                <textarea
                  value={c.texto}
                  rows={2}
                  onChange={(e) =>
                    setTextos((t) => t && { ...t, condicoesConsolidada: t.condicoesConsolidada.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })
                  }
                  style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, fontSize: "13px" }}
                />
              </label>
            ))}
            <label style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>Mensagem de fechamento</div>
              <textarea
                value={textos.mensagemFechamento}
                rows={2}
                onChange={(e) => setTextos((t) => t && { ...t, mensagemFechamento: e.target.value })}
                style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.45, fontSize: "13px" }}
              />
            </label>
          </div>

          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".04em", margin: "6px 0 8px" }}>Orçamento e Comercial</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 16px", marginBottom: "14px" }}>
            {rotulosComerciais.map(({ k, label }) => (
              <label key={k} style={{ minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "4px" }}>{label}</div>
                <input
                  value={textos.condicoesComerciais[k]}
                  onChange={(e) => setTextos((t) => t && { ...t, condicoesComerciais: { ...t.condicoesComerciais, [k]: e.target.value } })}
                  style={{ ...inputStyle, width: "100%", fontSize: "13px" }}
                />
              </label>
            ))}
          </div>

          <button style={btn("var(--blue-600)", !salvando)} disabled={salvando} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar textos padrão"}
          </button>
        </>
      )}
    </section>
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
  onSenha,
  onRemover,
}: {
  colaborador: Colaborador;
  onSalvar: (email: string, dados: { nome?: string; telefone?: string }) => void;
  onMudar: (email: string, dados: { acesso?: Acesso; papel?: "admin" | "user" }, feito: string) => void;
  onSenha: (colaborador: Colaborador, senha: string) => void;
  onRemover: (colaborador: Colaborador) => void;
}) {
  const [telefone, setTelefone] = useState(colaborador.telefone ?? "");
  // Nome também é editável na linha (pedido do Matheus, ago/2026: criar/alterar/remover
  // o máximo possível daqui). E-mail não muda — é a chave do login e das propostas.
  const [nome, setNome] = useState(colaborador.nome);
  // Senha inline: o botão abre um campo na própria linha (o prompt() do navegador não
  // deixava ver o que se digita nem cancelar direito, e destoava do resto do painel).
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [senha, setSenha] = useState("");
  const mudou = telefone.trim() !== (colaborador.telefone ?? "") || (nome.trim() !== colaborador.nome && nome.trim().length >= 2);
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
          <input
            style={{ ...inputStyle, padding: "4px 8px", fontSize: "13px", fontWeight: 600, flex: "1 1 auto", minWidth: 0 }}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            title="Nome do colaborador (edite e clique em Salvar)"
          />
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: ui.fg, background: ui.bg, borderRadius: "999px", padding: "2px 8px", flex: "none" }}>{ui.label}</span>
        </div>
        <div style={{ fontSize: "11.5px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "3px" }}>
          {colaborador.email} · {ehGestor ? "Gestor" : "Vendedor"}
        </div>
      </div>

      <input style={{ ...inputStyle, width: "132px", flex: "none", padding: "6px 10px", fontSize: "13px" }} placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      <button
        style={{ ...btn("var(--blue-600)", mudou), width: "78px" }}
        disabled={!mudou}
        onClick={() => mudou && onSalvar(colaborador.email, {
          ...(nome.trim() !== colaborador.nome && nome.trim().length >= 2 ? { nome: nome.trim() } : {}),
          ...(telefone.trim() !== (colaborador.telefone ?? "") ? { telefone: telefone.trim() } : {}),
        })}
      >Salvar</button>

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

      <button
        style={{ ...btn("var(--gray-500)"), width: "72px", background: senhaAberta ? "var(--gray-100)" : "white", color: "var(--gray-700)", border: "1px solid var(--gray-200)" }}
        title="Define uma senha nova para este login"
        onClick={() => { setSenhaAberta(!senhaAberta); setSenha(""); }}
      >
        Senha
      </button>

      <button
        style={{ ...btn("#dc2626"), padding: "9px 11px" }}
        title="Remove a conta em definitivo (as propostas ficam)"
        onClick={() => onRemover(colaborador)}
      >
        ✕
      </button>

      {senhaAberta && (
        <div style={{ flexBasis: "100%", display: "flex", gap: "8px", alignItems: "center", marginTop: "2px" }}>
          <input
            style={{ ...inputStyle, flex: "1 1 200px", padding: "6px 10px", fontSize: "13px" }}
            type="password"
            placeholder={`Nova senha para ${colaborador.nome} (mín. 8)`}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoFocus
          />
          <button
            style={{ ...btn("var(--blue-600)", senha.length >= 8), width: "96px" }}
            disabled={senha.length < 8}
            onClick={() => { if (senha.length >= 8) { onSenha(colaborador, senha); setSenhaAberta(false); setSenha(""); } }}
          >
            Redefinir
          </button>
          <button
            style={{ ...btn("var(--gray-500)"), background: "white", color: "var(--gray-500)", border: "1px solid var(--gray-200)" }}
            onClick={() => { setSenhaAberta(false); setSenha(""); }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
