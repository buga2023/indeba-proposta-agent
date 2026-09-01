"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { VisitaCarteira, StatusVisita, ContratoComodato, EstoqueComodato, AnexoInfo, TipoRegistroAnexo } from "@/lib/contracts";
import { autorLabel } from "@/lib/utils";
import { encolherFoto } from "@/components/form-produto";

/**
 * Ferramentas Técnicas (áudio do Mateus 21/08/2026 + foto do bloco, que dá os rótulos),
 * três abas:
 *  - Relatório de Visitas de Rotina: data, horário, cliente, quem recebeu, telefone,
 *    status (resolvido / não resolvido) e observação.
 *  - Contratos e Comodatos: cliente, comodatos (texto), observações e o contrato em PDF,
 *    disposto em linhas — clica na linha para abrir todas as informações.
 *  - Estoque de Comodatos: código, peça, quantidade e OBS, com exportação para Excel.
 *
 * Todo vendedor escreve; cada um vê só os próprios registros, o gestor vê todos (o recorte
 * é do servidor — aqui a tela só mostra o que a API devolve).
 */

type Aba = "visitas" | "contratos" | "estoque";

export const inputStyle = {
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

export const labelStyle = { fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", display: "block" } as const;

export const cardStyle = {
  background: "white",
  border: "1px solid var(--gray-200)",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "22px",
  boxShadow: "var(--shadow-sm)",
} as const;

export const botaoPrimario = (ocupado: boolean) =>
  ({
    justifySelf: "start",
    padding: "11px 22px",
    background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))",
    border: "none",
    borderRadius: "10px",
    cursor: ocupado ? "not-allowed" : "pointer",
    fontSize: "14px",
    fontWeight: 700,
    color: "white",
    opacity: ocupado ? 0.6 : 1,
  }) as const;

export const botaoExcluir = {
  padding: "5px 11px",
  borderRadius: "999px",
  border: "1px solid #fecaca",
  background: "white",
  color: "#b91c1c",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  flex: "none",
} as const;

export const botaoEditar = {
  padding: "5px 11px",
  borderRadius: "999px",
  border: "1px solid var(--blue-600)",
  background: "white",
  color: "var(--blue-600)",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  flex: "none",
} as const;

/**
 * Comprovante em PDF do registro (áudio do Mateus, 31/08/2026: "em todos os registros, dê
 * a opção da gente também importar em PDF… como se fosse um documento de comprovação").
 *
 * É um link, não um botão com fetch: a rota é GET e responde com Content-Disposition
 * attachment, então o próprio navegador baixa o arquivo. Com fetch seria preciso montar
 * blob + link temporário à mão para chegar no mesmo lugar — e o render do Chromium leva
 * alguns segundos, tempo em que o link já dá o feedback nativo de download.
 */
export function BotaoPdf({ tipo, id }: { tipo: "prospeccao" | "visita" | "solicitacao" | "contrato" | "estoque"; id: string }) {
  return (
    <a
      href={`/api/comprovante?tipo=${tipo}&id=${encodeURIComponent(id)}`}
      title="Baixar comprovante em PDF (com os dados e as fotos deste registro)"
      style={{ ...botaoEditar, textDecoration: "none", display: "inline-block" }}
    >
      PDF
    </a>
  );
}

const STATUS_VISITA: Record<StatusVisita, { label: string; cor: string; bg: string }> = {
  resolvido: { label: "Resolvido", cor: "#15803d", bg: "#dcfce7" },
  nao_resolvido: { label: "Não resolvido", cor: "#b45309", bg: "#fef3c7" },
};

export function mensagemErro(d: unknown, fallback: string): string {
  if (d && typeof d === "object" && "erro" in d && typeof (d as { erro: unknown }).erro === "string") {
    return (d as { erro: string }).erro;
  }
  return fallback;
}

export const fmtData = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

export function FerramentasTecnicasScreen() {
  const [aba, setAba] = useState<Aba>("visitas");
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
        <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-.5px", margin: 0 }}>Ferramentas Técnicas</h2>
        <div style={{ fontSize: "13.5px", opacity: 0.9, marginTop: "6px", lineHeight: 1.5 }}>
          Relatório de visitas de rotina, contratos e comodatos, e estoque de comodatos.{" "}
          {souGestor ? "Como gestor, você vê os registros de toda a equipe." : "Você vê apenas os seus registros."}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "18px" }}>
        {(
          [
            // "Registro", não "Relatório" — áudio do Mateus, 25/08/2026.
            { key: "visitas", label: "Registro de Visitas de Rotina" },
            { key: "contratos", label: "Contratos e Comodatos" },
            { key: "estoque", label: "Estoque de Comodatos" },
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

      {aba === "visitas" && <AbaVisitas area="tecnica" setErro={setErro} setSouGestor={setSouGestor} souGestor={souGestor} />}
      {aba === "contratos" && <AbaContratos setErro={setErro} setSouGestor={setSouGestor} souGestor={souGestor} />}
      {aba === "estoque" && <AbaEstoque setErro={setErro} setSouGestor={setSouGestor} souGestor={souGestor} />}
    </div>
  );
}

export type AbaProps = {
  setErro: (e: string | null) => void;
  setSouGestor: (v: boolean) => void;
  souGestor: boolean;
};

/* ═══════════ Aba Excluídos (compartilhada) ═══════════ */

// Pedido do Mateus (25/08/2026): "a opção de excluir, eu preciso ter aba de excluídos e
// excluí-lo definitivamente". Excluir vira lápide; aqui o gestor restaura ou apaga de vez.
// Genérico porque o esquema é o MESMO em visitas, prospecções, solicitações, contratos e
// estoque — só mudam o endpoint, o campo da resposta e como cada linha se apresenta.
export function BotaoExcluidos({ ativo, onClick }: { ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginLeft: "auto",
        padding: "6px 14px",
        borderRadius: "999px",
        border: `1px solid ${ativo ? "#b91c1c" : "var(--gray-200)"}`,
        background: ativo ? "#b91c1c" : "white",
        color: ativo ? "white" : "var(--gray-500)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        flex: "none",
      }}
    >
      {ativo ? "← Voltar aos registros" : "Excluídos"}
    </button>
  );
}

export function BlocoExcluidos<T extends { id: string }>({
  endpoint,
  chave,
  render,
  setErro,
  aoMudar,
}: {
  endpoint: string; // a mesma URL da listagem (ex.: "/api/visitas?area=tecnica")
  chave: string; // campo da resposta com a lista (ex.: "visitas")
  render: (item: T) => ReactNode;
  setErro: (e: string | null) => void;
  aoMudar: () => void | Promise<void>; // recarrega a lista dos vivos após restaurar
}) {
  const [itens, setItens] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);
  const sep = endpoint.includes("?") ? "&" : "?";

  async function carregar() {
    try {
      const r = await fetch(`${endpoint}${sep}excluidas=1`);
      const d = await r.json();
      if (!r.ok) throw new Error(mensagemErro(d, "Falha ao carregar os excluídos."));
      setErro(null);
      setItens((d as Record<string, T[]>)[chave] ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar os excluídos.");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(carregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restaurar(id: string) {
    try {
      const r = await fetch(`${endpoint}${sep}id=${encodeURIComponent(id)}&acao=restaurar`, { method: "PATCH" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao restaurar o registro."));
      await carregar();
      await aoMudar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao restaurar o registro.");
    }
  }

  async function excluirDefinitivo(id: string) {
    if (!window.confirm("Excluir DEFINITIVAMENTE? Esta ação não tem volta.")) return;
    try {
      const r = await fetch(`${endpoint}${sep}id=${encodeURIComponent(id)}&definitivo=1`, { method: "DELETE" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao excluir definitivamente."));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir definitivamente.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: ".4px" }}>
        Excluídos · {itens.length}
      </div>
      {carregando && <div style={{ color: "var(--gray-500)", fontSize: "14px" }}>Carregando…</div>}
      {!carregando && itens.length === 0 && (
        <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>Nenhum registro excluído.</div>
      )}
      {itens.map((item) => (
        <div key={item.id} style={{ background: "#fff7f7", border: "1px solid #fecaca", borderRadius: "14px", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>{render(item)}</div>
            <button onClick={() => restaurar(item.id)} style={botaoEditar}>
              Restaurar
            </button>
            <button onClick={() => excluirDefinitivo(item.id)} style={botaoExcluir}>
              Excluir definitivamente
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════ Anexos (compartilhado) ═══════════ */

// Anexar foto e documento em TODAS as ferramentas (áudio do Mateus, 27/08/2026) — o mesmo
// bloco serve prospecções, solicitações, contratos e estoque; as visitas têm rotas
// próprias (VisitaFoto + documento na linha), mas a aparência é a mesma.

const pillLink = {
  padding: "6px 14px",
  borderRadius: "999px",
  border: "1px solid var(--blue-600)",
  color: "var(--blue-600)",
  fontSize: "12.5px",
  fontWeight: 600,
  textDecoration: "none",
} as const;

const botaoTirarAnexo = {
  border: "1px solid #fecaca",
  background: "white",
  color: "#b91c1c",
  borderRadius: "999px",
  width: "20px",
  height: "20px",
  fontSize: "12px",
  lineHeight: 1,
  cursor: "pointer",
  flex: "none",
  padding: 0,
} as const;

// Campos de anexo do formulário de cadastro: fotos (várias) + documentos (vários — o
// Mateus tem "três ou quatro contratos" por cliente).
export function CampoAnexos({
  fotos,
  setFotos,
  documentos,
  setDocumentos,
  inputKey,
}: {
  fotos: File[];
  setFotos: (f: File[]) => void;
  documentos: File[];
  setDocumentos: (f: File[]) => void;
  inputKey: number;
}) {
  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      <label style={{ ...labelStyle, flex: 1, minWidth: "220px" }}>
        Fotos ({fotos.length}/10)
        <input
          key={`f${inputKey}`}
          type="file"
          accept="image/*"
          multiple
          style={{ ...inputStyle, marginTop: "5px", padding: "8px 12px" }}
          onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, 10))}
        />
      </label>
      <label style={{ ...labelStyle, flex: 1, minWidth: "220px" }}>
        Documentos ({documentos.length}/10 · PDF ou imagem, até 4 MB cada)
        <input
          key={`d${inputKey}`}
          type="file"
          accept="application/pdf,image/*"
          multiple
          style={{ ...inputStyle, marginTop: "5px", padding: "8px 12px" }}
          onChange={(e) => setDocumentos(Array.from(e.target.files ?? []).slice(0, 10))}
        />
      </label>
    </div>
  );
}

// Sobe os anexos UM por requisição (cada uma fica abaixo do teto de ~4,5 MB da Vercel) e
// devolve os nomes que falharam — falha de anexo não desfaz o registro.
export async function enviarAnexos(
  tipo: TipoRegistroAnexo,
  registroId: string,
  fotos: File[],
  documentos: File[],
): Promise<string[]> {
  const falhas: string[] = [];
  const subir = async (arquivo: File, categoria: "foto" | "documento") => {
    const form = new FormData();
    form.set("registroTipo", tipo);
    form.set("registroId", registroId);
    form.set("categoria", categoria);
    form.set("arquivo", arquivo);
    const r = await fetch("/api/anexos", { method: "POST", body: form });
    if (!r.ok) falhas.push(arquivo.name);
  };
  for (const original of fotos) {
    const leve = await encolherFoto(original);
    if (leve.size > 4 * 1024 * 1024) {
      falhas.push(`${original.name} (acima de 4 MB mesmo comprimida)`);
      continue;
    }
    await subir(leve, "foto");
  }
  for (const doc of documentos) {
    if (doc.size > 4 * 1024 * 1024) {
      falhas.push(`${doc.name} (acima de 4 MB)`);
      continue;
    }
    await subir(doc, "documento");
  }
  return falhas;
}

// Mostra os anexos de um registro; em modo editável dá o ✕ para tirar o anexo errado e o
// "maisinho" para adicionar mais (áudio do Mateus, 27/08/2026).
export function BlocoAnexos({
  tipo,
  registroId,
  anexos,
  editavel,
  aoMudar,
  setErro,
}: {
  tipo: TipoRegistroAnexo;
  registroId: string;
  anexos: AnexoInfo[];
  editavel: boolean;
  aoMudar: () => void | Promise<void>;
  setErro: (e: string | null) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const fotos = anexos.filter((a) => a.categoria === "foto");
  const documentos = anexos.filter((a) => a.categoria === "documento");
  if (!editavel && anexos.length === 0) return null;

  async function tirar(id: string) {
    if (!window.confirm("Excluir este anexo?")) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/anexos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao excluir o anexo."));
      setErro(null);
      await aoMudar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir o anexo.");
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar(arquivos: File[], categoria: "foto" | "documento") {
    if (arquivos.length === 0) return;
    setOcupado(true);
    try {
      const falhas = await enviarAnexos(
        tipo,
        registroId,
        categoria === "foto" ? arquivos : [],
        categoria === "documento" ? arquivos : [],
      );
      setErro(falhas.length > 0 ? `Alguns anexos falharam: ${falhas.join(", ")}.` : null);
      await aoMudar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px", opacity: ocupado ? 0.6 : 1 }}>
      {fotos.map((a) => (
        <span key={a.id} style={{ position: "relative", display: "inline-block" }}>
          <a href={`/api/anexos/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- rota autenticada, sem otimizador */}
            <img
              src={`/api/anexos/${encodeURIComponent(a.id)}`}
              alt={a.nome ?? "Foto anexada"}
              style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--gray-200)", display: "block" }}
            />
          </a>
          {editavel && (
            <button title="Excluir foto" onClick={() => tirar(a.id)} style={{ ...botaoTirarAnexo, position: "absolute", top: "-7px", right: "-7px" }}>
              ×
            </button>
          )}
        </span>
      ))}
      {documentos.map((a) => (
        <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <a href={`/api/anexos/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer" style={pillLink}>
            Abrir documento{a.nome ? ` (${a.nome})` : ""}
          </a>
          {editavel && (
            <button title="Excluir documento" onClick={() => tirar(a.id)} style={botaoTirarAnexo}>
              ×
            </button>
          )}
        </span>
      ))}
      {editavel && (
        <>
          <label style={{ ...pillLink, cursor: "pointer" }}>
            + foto
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                void adicionar(Array.from(e.target.files ?? []), "foto");
                e.target.value = "";
              }}
            />
          </label>
          <label style={{ ...pillLink, cursor: "pointer" }}>
            + documento
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                void adicionar(Array.from(e.target.files ?? []), "documento");
                e.target.value = "";
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}

// Anexos da visita em modo edição (áudio do Mateus, 27/08/2026: excluir/substituir a foto
// e o anexo, e adicionar mais) — usa as rotas próprias da visita, visual do BlocoAnexos.
function AnexosVisitaEditavel({
  v,
  aoMudar,
  setErro,
}: {
  v: VisitaCarteira;
  aoMudar: () => void | Promise<void>;
  setErro: (e: string | null) => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function chamar(url: string, init: RequestInit, fallback: string) {
    setOcupado(true);
    try {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(mensagemErro(await r.json(), fallback));
      setErro(null);
      await aoMudar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : fallback);
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarFotos(arquivos: File[]) {
    setOcupado(true);
    const falhas: string[] = [];
    try {
      for (const original of arquivos) {
        const leve = await encolherFoto(original);
        if (leve.size > 4 * 1024 * 1024) {
          falhas.push(`${original.name} (acima de 4 MB mesmo comprimida)`);
          continue;
        }
        const form = new FormData();
        form.set("foto", leve);
        const r = await fetch(`/api/visitas/${encodeURIComponent(v.id)}/fotos`, { method: "POST", body: form });
        if (!r.ok) falhas.push(original.name);
      }
      setErro(falhas.length > 0 ? `Alguns anexos falharam: ${falhas.join(", ")}.` : null);
      await aoMudar();
    } finally {
      setOcupado(false);
    }
  }

  function trocarDocumento(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > 4 * 1024 * 1024) {
      setErro("Documento acima de 4 MB — a plataforma recusa envios maiores.");
      return;
    }
    const form = new FormData();
    form.set("documento", arquivo);
    void chamar(`/api/visitas/${encodeURIComponent(v.id)}/documento`, { method: "POST", body: form }, "Falha ao anexar o documento.");
  }

  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: "2px" }}>Anexos</div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", opacity: ocupado ? 0.6 : 1 }}>
        {v.fotos.map((fotoId) => (
          <span key={fotoId} style={{ position: "relative", display: "inline-block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rota autenticada, sem otimizador */}
            <img
              src={`/api/visitas/${encodeURIComponent(v.id)}/fotos/${encodeURIComponent(fotoId)}`}
              alt="Foto da visita"
              style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--gray-200)", display: "block" }}
            />
            <button
              title="Excluir foto"
              onClick={() => {
                if (window.confirm("Excluir esta foto?")) {
                  void chamar(
                    `/api/visitas/${encodeURIComponent(v.id)}/fotos/${encodeURIComponent(fotoId)}`,
                    { method: "DELETE" },
                    "Falha ao excluir a foto.",
                  );
                }
              }}
              style={{ ...botaoTirarAnexo, position: "absolute", top: "-7px", right: "-7px" }}
            >
              ×
            </button>
          </span>
        ))}
        {v.temDocumento && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <a href={`/api/visitas/${encodeURIComponent(v.id)}/documento`} target="_blank" rel="noreferrer" style={pillLink}>
              Abrir documento{v.documentoNome ? ` (${v.documentoNome})` : ""}
            </a>
            <button
              title="Excluir documento"
              onClick={() => {
                if (window.confirm("Excluir este documento?")) {
                  void chamar(`/api/visitas/${encodeURIComponent(v.id)}/documento`, { method: "DELETE" }, "Falha ao excluir o documento.");
                }
              }}
              style={botaoTirarAnexo}
            >
              ×
            </button>
          </span>
        )}
        <label style={{ ...pillLink, cursor: "pointer" }}>
          + foto
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              void adicionarFotos(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
        <label style={{ ...pillLink, cursor: "pointer" }}>
          {v.temDocumento ? "substituir documento" : "+ documento"}
          <input
            type="file"
            accept="application/pdf,image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              trocarDocumento(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

/* ═══════════ Aba 1 — Registro de Visitas da Carteira ═══════════ */

// Exportada: a foto do bloco lista o MESMO relatório nas Ferramentas Comerciais e nas
// Técnicas — `area` diz de qual tela o registro é (a API separa as listas por ela).
export function AbaVisitas({ area, setErro, setSouGestor, souGestor }: AbaProps & { area: "comercial" | "tecnica" }) {
  const [visitas, setVisitas] = useState<VisitaCarteira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const hoje = new Date();
  const [data, setData] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`,
  );
  const [horario, setHorario] = useState("");
  const [cliente, setCliente] = useState("");
  const [quemRecebeu, setQuemRecebeu] = useState("");
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState<StatusVisita>("nao_resolvido");
  const [observacao, setObservacao] = useState("");
  // Anexos (áudio do Mateus, 25/08/2026): até 10 fotos e um documento por visita — o João
  // bate foto dos equipamentos e anexa a assinatura colhida no cliente.
  const [fotos, setFotos] = useState<File[]>([]);
  const [documento, setDocumento] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0); // reset dos <input type="file"> após salvar

  // Edição (áudio do Mateus, 25/08/2026): usuário e gestor editam; a data NÃO muda.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ed, setEd] = useState({ horario: "", cliente: "", quemRecebeu: "", telefone: "", status: "nao_resolvido" as StatusVisita, observacao: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  // Aba Excluídos (só o gestor exclui/restaura).
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  // Status resolvido/não resolvido é só da visita TÉCNICA (áudio do Mateus, 25/08/2026:
  // "isso aqui é uma visita de rotina… ferramenta comercial, não precisa").
  const comStatus = area === "tecnica";

  async function carregar() {
    try {
      const r = await fetch(`/api/visitas?area=${area}`);
      const d = await r.json();
      if (!r.ok) throw new Error(mensagemErro(d, "Falha ao carregar as visitas."));
      setErro(null);
      setVisitas(d.visitas);
      setSouGestor(d.souGestor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as visitas.");
    } finally {
      setCarregando(false);
    }
  }
  // Carrega por callback de promise — setState síncrono no corpo do effect encadeia render
  // extra (React 19 acusa); mesmo desenho de chamados-screen.tsx.
  useEffect(() => {
    void Promise.resolve().then(carregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lancar(e: FormEvent) {
    e.preventDefault();
    if (!data || !horario || cliente.trim().length < 2 || quemRecebeu.trim().length < 2) {
      setErro("Preencha data, horário, cliente e quem recebeu.");
      return;
    }
    if (fotos.length > 10) {
      setErro("No máximo 10 fotos por visita.");
      return;
    }
    if (documento && documento.type !== "application/pdf" && !documento.type.startsWith("image/")) {
      setErro("O documento anexado deve ser um PDF ou uma imagem.");
      return;
    }
    if (documento && documento.size > 4 * 1024 * 1024) {
      setErro("Documento acima de 4 MB — a plataforma recusa envios maiores.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area,
          data,
          horario,
          cliente: cliente.trim(),
          quemRecebeu: quemRecebeu.trim(),
          telefone: telefone.trim() || null,
          status,
          observacao: observacao.trim() || null,
        }),
      });
      const criada = await r.json();
      if (!r.ok) throw new Error(mensagemErro(criada, "Falha ao registrar a visita."));

      // Anexos depois do registro, UM por requisição — o lote inteiro num POST só
      // estouraria o teto de ~4,5 MB da função da Vercel. Falha de anexo não desfaz a
      // visita: o registro vale mais que a foto, e dá para tentar de novo.
      const falhas: string[] = [];
      for (const original of fotos) {
        const leve = await encolherFoto(original);
        if (leve.size > 4 * 1024 * 1024) {
          falhas.push(`${original.name} (acima de 4 MB mesmo comprimida)`);
          continue;
        }
        const form = new FormData();
        form.set("foto", leve);
        const rf = await fetch(`/api/visitas/${encodeURIComponent(criada.id)}/fotos`, { method: "POST", body: form });
        if (!rf.ok) falhas.push(original.name);
      }
      if (documento) {
        const form = new FormData();
        form.set("documento", documento);
        const rd = await fetch(`/api/visitas/${encodeURIComponent(criada.id)}/documento`, { method: "POST", body: form });
        if (!rd.ok) falhas.push(documento.name);
      }
      if (falhas.length > 0) {
        setErro(`Visita registrada, mas alguns anexos falharam: ${falhas.join(", ")}.`);
      }

      setCliente("");
      setQuemRecebeu("");
      setTelefone("");
      setObservacao("");
      setStatus("nao_resolvido");
      setFotos([]);
      setDocumento(null);
      setInputKey((k) => k + 1);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar a visita.");
    } finally {
      setEnviando(false);
    }
  }

  // Excluir é só do gestor (o botão nem aparece para o vendedor); vai para a aba
  // Excluídos, de onde dá para restaurar ou excluir definitivamente.
  async function excluir(id: string) {
    if (!window.confirm("Excluir este registro de visita? Ele vai para a aba Excluídos.")) return;
    try {
      const r = await fetch(`/api/visitas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao excluir a visita."));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir a visita.");
    }
  }

  function abrirEdicao(v: VisitaCarteira) {
    setEditandoId(v.id);
    setEd({
      horario: v.horario,
      cliente: v.cliente,
      quemRecebeu: v.quemRecebeu,
      telefone: v.telefone ?? "",
      status: v.status,
      observacao: v.observacao ?? "",
    });
    setErro(null);
  }

  async function salvarEdicao(id: string) {
    if (!ed.horario || ed.cliente.trim().length < 2 || ed.quemRecebeu.trim().length < 2) {
      setErro("Preencha horário, cliente e quem recebeu.");
      return;
    }
    setSalvandoEdicao(true);
    setErro(null);
    try {
      const r = await fetch(`/api/visitas?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horario: ed.horario,
          cliente: ed.cliente.trim(),
          quemRecebeu: ed.quemRecebeu.trim(),
          telefone: ed.telefone.trim() || null,
          status: ed.status,
          observacao: ed.observacao.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao editar a visita."));
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao editar a visita.");
    } finally {
      setSalvandoEdicao(false);
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
            {comStatus && (
              <label style={{ ...labelStyle, flex: 1, minWidth: "170px" }}>
                Status
                <select style={{ ...inputStyle, marginTop: "5px" }} value={status} onChange={(e) => setStatus(e.target.value as StatusVisita)}>
                  <option value="nao_resolvido">Não resolvido</option>
                  <option value="resolvido">Resolvido</option>
                </select>
              </label>
            )}
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 2, minWidth: "200px" }}>
              Cliente
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Nome do cliente" maxLength={200} value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 2, minWidth: "180px" }}>
              Quem recebeu
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Quem recebeu a visita" maxLength={200} value={quemRecebeu} onChange={(e) => setQuemRecebeu(e.target.value)} />
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
              placeholder="O que foi tratado, pendências…"
              maxLength={4000}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: "220px" }}>
              Fotos ({fotos.length}/10)
              <input
                key={`f${inputKey}`}
                type="file"
                accept="image/*"
                multiple
                style={{ ...inputStyle, marginTop: "5px", padding: "8px 12px" }}
                onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, 10))}
              />
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: "220px" }}>
              Documento (PDF ou imagem, até 4 MB)
              <input
                key={`d${inputKey}`}
                type="file"
                accept="application/pdf,image/*"
                style={{ ...inputStyle, marginTop: "5px", padding: "8px 12px" }}
                onChange={(e) => setDocumento(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button type="submit" disabled={enviando} style={botaoPrimario(enviando)}>
            {enviando ? "Registrando…" : "Registrar visita"}
          </button>
        </div>
      </form>

      {mostrarExcluidos && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <BotaoExcluidos ativo onClick={() => setMostrarExcluidos(false)} />
          </div>
          <BlocoExcluidos<VisitaCarteira>
            endpoint={`/api/visitas?area=${area}`}
            chave="visitas"
            setErro={setErro}
            aoMudar={carregar}
            render={(v) => (
              <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>
                <b>{fmtData(v.data)} às {v.horario}</b> · {v.cliente} · Recebeu: {v.quemRecebeu}
                {souGestor ? ` · ${autorLabel(v)}` : ""}
              </span>
            )}
          />
        </div>
      )}
      {!mostrarExcluidos && (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px" }}>
            {souGestor ? "Todas as visitas" : "Minhas visitas"} · {visitas.length}
          </div>
          {souGestor && <BotaoExcluidos ativo={false} onClick={() => setMostrarExcluidos(true)} />}
        </div>
        {carregando && <div style={{ color: "var(--gray-500)", fontSize: "14px" }}>Carregando…</div>}
        {!carregando && visitas.length === 0 && <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>Nenhuma visita registrada ainda.</div>}
        {visitas.map((v) => {
          const st = STATUS_VISITA[v.status];
          const emEdicao = editandoId === v.id;
          return (
            <div key={v.id} style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {comStatus && (
                  <span style={{ fontWeight: 700, fontSize: "12px", padding: "3px 9px", borderRadius: "999px", color: st.cor, background: st.bg }}>{st.label}</span>
                )}
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>
                  {fmtData(v.data)} às {v.horario}
                </span>
                <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>· {v.cliente}</span>
                {souGestor && <span style={{ fontSize: "12px", color: "var(--gray-400)" }}>· {autorLabel(v)}</span>}
                {!emEdicao && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                    <BotaoPdf tipo="visita" id={v.id} />
                    <button onClick={() => abrirEdicao(v)} style={botaoEditar}>
                      Editar
                    </button>
                    {/* Excluir é só do gestor — o vendedor só edita (áudio 25/08/2026). */}
                    {souGestor && (
                      <button onClick={() => excluir(v.id)} style={botaoExcluir}>
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
                    {comStatus && (
                      <label style={{ ...labelStyle, flex: 1, minWidth: "150px" }}>
                        Status
                        <select style={{ ...inputStyle, marginTop: "5px" }} value={ed.status} onChange={(e) => setEd({ ...ed, status: e.target.value as StatusVisita })}>
                          <option value="nao_resolvido">Não resolvido</option>
                          <option value="resolvido">Resolvido</option>
                        </select>
                      </label>
                    )}
                    <label style={{ ...labelStyle, flex: 2, minWidth: "180px" }}>
                      Cliente
                      <input style={{ ...inputStyle, marginTop: "5px" }} maxLength={200} value={ed.cliente} onChange={(e) => setEd({ ...ed, cliente: e.target.value })} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <label style={{ ...labelStyle, flex: 2, minWidth: "180px" }}>
                      Quem recebeu
                      <input style={{ ...inputStyle, marginTop: "5px" }} maxLength={200} value={ed.quemRecebeu} onChange={(e) => setEd({ ...ed, quemRecebeu: e.target.value })} />
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
                      maxLength={4000}
                      value={ed.observacao}
                      onChange={(e) => setEd({ ...ed, observacao: e.target.value })}
                    />
                  </label>
                  <AnexosVisitaEditavel v={v} aoMudar={carregar} setErro={setErro} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => salvarEdicao(v.id)} disabled={salvandoEdicao} style={botaoPrimario(salvandoEdicao)}>
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
              <div style={{ fontSize: "13px", color: "var(--gray-700)", marginTop: "6px" }}>
                Recebeu: <b>{v.quemRecebeu}</b>
                {v.telefone ? ` · Tel: ${v.telefone}` : ""}
              </div>
              {v.observacao && (
                <div style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "4px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{v.observacao}</div>
              )}
                </>
              )}
              {!emEdicao && (v.fotos.length > 0 || v.temDocumento) && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                  {v.fotos.map((fotoId) => (
                    <a key={fotoId} href={`/api/visitas/${encodeURIComponent(v.id)}/fotos/${encodeURIComponent(fotoId)}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- rota autenticada, sem otimizador */}
                      <img
                        src={`/api/visitas/${encodeURIComponent(v.id)}/fotos/${encodeURIComponent(fotoId)}`}
                        alt="Foto da visita"
                        style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--gray-200)", display: "block" }}
                      />
                    </a>
                  ))}
                  {v.temDocumento && (
                    <a
                      href={`/api/visitas/${encodeURIComponent(v.id)}/documento`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: "6px 14px", borderRadius: "999px", border: "1px solid var(--blue-600)", color: "var(--blue-600)", fontSize: "12.5px", fontWeight: 600, textDecoration: "none" }}
                    >
                      Abrir documento{v.documentoNome ? ` (${v.documentoNome})` : ""}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}

/* ═══════════ Aba 2 — Contratos e Comodatos ═══════════ */

function AbaContratos({ setErro, setSouGestor, souGestor }: AbaProps) {
  const [contratos, setContratos] = useState<ContratoComodato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  // Linha aberta: o Mateus pediu tudo em linha, com um iconezinho que abre as informações.
  const [aberto, setAberto] = useState<string | null>(null);

  const [cliente, setCliente] = useState("");
  const [comodatos, setComodatos] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  // Anexos genéricos (áudio do Mateus, 27/08/2026): vários contratos e fotos por cliente.
  const [fotosNovas, setFotosNovas] = useState<File[]>([]);
  const [documentosNovos, setDocumentosNovos] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0); // reset do <input type="file"> após salvar

  // Edição (áudio do Mateus, 25/08/2026) + aba Excluídos.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ed, setEd] = useState({ cliente: "", comodatos: "", observacoes: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/comodatos");
      const d = await r.json();
      if (!r.ok) throw new Error(mensagemErro(d, "Falha ao carregar os contratos."));
      setErro(null);
      setContratos(d.contratos);
      setSouGestor(d.souGestor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar os contratos.");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(carregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (cliente.trim().length < 2 || comodatos.trim().length < 1) {
      setErro("Preencha o nome do cliente e os comodatos do contrato.");
      return;
    }
    if (arquivo && arquivo.type !== "application/pdf") {
      setErro("O contrato anexado deve ser um PDF.");
      return;
    }
    if (arquivo && arquivo.size > 4 * 1024 * 1024) {
      setErro("Contrato acima de 4 MB — a plataforma recusa envios maiores.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.set(
        "dados",
        JSON.stringify({ cliente: cliente.trim(), comodatos: comodatos.trim(), observacoes: observacoes.trim() || null }),
      );
      if (arquivo) form.set("contrato", arquivo);
      const r = await fetch("/api/comodatos", { method: "POST", body: form });
      const criado = await r.json();
      if (!r.ok) throw new Error(mensagemErro(criado, "Falha ao cadastrar o contrato."));
      const falhas = await enviarAnexos("contrato", criado.id, fotosNovas, documentosNovos);
      if (falhas.length > 0) setErro(`Contrato cadastrado, mas alguns anexos falharam: ${falhas.join(", ")}.`);
      setCliente("");
      setComodatos("");
      setObservacoes("");
      setArquivo(null);
      setFotosNovas([]);
      setDocumentosNovos([]);
      setInputKey((k) => k + 1);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao cadastrar o contrato.");
    } finally {
      setEnviando(false);
    }
  }

  async function salvarEdicao(id: string) {
    if (ed.cliente.trim().length < 2 || ed.comodatos.trim().length < 1) {
      setErro("Preencha o nome do cliente e os comodatos do contrato.");
      return;
    }
    setSalvandoEdicao(true);
    setErro(null);
    try {
      const r = await fetch(`/api/comodatos?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente: ed.cliente.trim(), comodatos: ed.comodatos.trim(), observacoes: ed.observacoes.trim() || null }),
      });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao editar o contrato."));
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao editar o contrato.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  // Excluir é só do gestor; o contrato vai para a aba Excluídos (restaurável).
  async function excluir(id: string) {
    if (!window.confirm("Excluir este contrato? Ele vai para a aba Excluídos.")) return;
    try {
      const r = await fetch(`/api/comodatos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao excluir o contrato."));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir o contrato.");
    }
  }

  return (
    <>
      <form onSubmit={salvar} style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <label style={labelStyle}>
            Nome do cliente
            <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Razão social ou nome do cliente" maxLength={200} value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </label>
          <label style={labelStyle}>
            Comodatos deste cliente
            <textarea
              style={{ ...inputStyle, marginTop: "5px", minHeight: "80px", resize: "vertical" }}
              placeholder="Liste os comodatos que estão neste contrato…"
              maxLength={8000}
              value={comodatos}
              onChange={(e) => setComodatos(e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Observações
            <textarea
              style={{ ...inputStyle, marginTop: "5px", minHeight: "60px", resize: "vertical" }}
              placeholder="Observações (opcional)"
              maxLength={4000}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Cópia do contrato (PDF, até 4 MB)
            <input
              key={inputKey}
              type="file"
              accept="application/pdf"
              style={{ ...inputStyle, marginTop: "5px", padding: "8px 12px" }}
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </label>
          <CampoAnexos fotos={fotosNovas} setFotos={setFotosNovas} documentos={documentosNovos} setDocumentos={setDocumentosNovos} inputKey={inputKey} />
          <button type="submit" disabled={enviando} style={botaoPrimario(enviando)}>
            {enviando ? "Salvando…" : "Cadastrar contrato"}
          </button>
        </div>
      </form>

      {mostrarExcluidos && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <BotaoExcluidos ativo onClick={() => setMostrarExcluidos(false)} />
          </div>
          <BlocoExcluidos<ContratoComodato>
            endpoint="/api/comodatos"
            chave="contratos"
            setErro={setErro}
            aoMudar={carregar}
            render={(c) => (
              <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>
                <b>{c.cliente}</b> · {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                {souGestor ? ` · ${autorLabel(c)}` : ""}
              </span>
            )}
          />
        </div>
      )}
      {!mostrarExcluidos && (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px" }}>
            {souGestor ? "Todos os contratos" : "Meus contratos"} · {contratos.length}
          </div>
          {souGestor && <BotaoExcluidos ativo={false} onClick={() => setMostrarExcluidos(true)} />}
        </div>
        {carregando && <div style={{ color: "var(--gray-500)", fontSize: "14px" }}>Carregando…</div>}
        {!carregando && contratos.length === 0 && <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>Nenhum contrato cadastrado ainda.</div>}
        {contratos.map((c) => {
          const estaAberto = aberto === c.id;
          return (
            <div key={c.id} style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", overflow: "hidden" }}>
              {/* A linha inteira abre/fecha — o "iconezinho" é a seta à esquerda. */}
              <button
                onClick={() => setAberto(estaAberto ? null : c.id)}
                style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "13px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  stroke="var(--gray-500)"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flex: "none", transform: estaAberto ? "rotate(90deg)" : "none", transition: "transform .15s" }}
                >
                  <path d="M4.5 2.5l4 4-4 4" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--gray-900)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.cliente}
                </span>
                {c.temContrato && (
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", background: "#e0edfb", color: "#1e6bb8", flex: "none" }}>PDF</span>
                )}
                {souGestor && <span style={{ fontSize: "12px", color: "var(--gray-400)", flex: "none" }}>{autorLabel(c)}</span>}
                <span style={{ fontSize: "12px", color: "var(--gray-400)", flex: "none" }}>
                  {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                </span>
              </button>
              {estaAberto && editandoId === c.id && (
                <div style={{ padding: "0 18px 15px 41px", display: "grid", gap: "10px" }}>
                  <label style={labelStyle}>
                    Nome do cliente
                    <input style={{ ...inputStyle, marginTop: "5px" }} maxLength={200} value={ed.cliente} onChange={(e) => setEd({ ...ed, cliente: e.target.value })} />
                  </label>
                  <label style={labelStyle}>
                    Comodatos deste cliente
                    <textarea
                      style={{ ...inputStyle, marginTop: "5px", minHeight: "80px", resize: "vertical" }}
                      maxLength={8000}
                      value={ed.comodatos}
                      onChange={(e) => setEd({ ...ed, comodatos: e.target.value })}
                    />
                  </label>
                  <label style={labelStyle}>
                    Observações
                    <textarea
                      style={{ ...inputStyle, marginTop: "5px", minHeight: "60px", resize: "vertical" }}
                      maxLength={4000}
                      value={ed.observacoes}
                      onChange={(e) => setEd({ ...ed, observacoes: e.target.value })}
                    />
                  </label>
                  <BlocoAnexos tipo="contrato" registroId={c.id} anexos={c.anexos} editavel aoMudar={carregar} setErro={setErro} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => salvarEdicao(c.id)} disabled={salvandoEdicao} style={botaoPrimario(salvandoEdicao)}>
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
              )}
              {estaAberto && editandoId !== c.id && (
                <div style={{ padding: "0 18px 15px 41px", display: "grid", gap: "10px" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>Comodatos</div>
                    <div style={{ fontSize: "13.5px", color: "var(--gray-700)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.comodatos}</div>
                  </div>
                  {c.observacoes && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>Observações</div>
                      <div style={{ fontSize: "13.5px", color: "var(--gray-700)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.observacoes}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {c.temContrato && (
                      <a
                        href={`/api/comodatos/${encodeURIComponent(c.id)}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: "6px 14px", borderRadius: "999px", border: "1px solid var(--blue-600)", color: "var(--blue-600)", fontSize: "12.5px", fontWeight: 600, textDecoration: "none" }}
                      >
                        Abrir contrato (PDF)
                      </a>
                    )}
                  </div>
                  <BlocoAnexos tipo="contrato" registroId={c.id} anexos={c.anexos} editavel={false} aoMudar={carregar} setErro={setErro} />
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <BotaoPdf tipo="contrato" id={c.id} />
                    <button
                      onClick={() => {
                        setEditandoId(c.id);
                        setEd({ cliente: c.cliente, comodatos: c.comodatos, observacoes: c.observacoes ?? "" });
                        setErro(null);
                      }}
                      style={botaoEditar}
                    >
                      Editar
                    </button>
                    {/* Excluir é só do gestor — o vendedor só edita (áudio 25/08/2026). */}
                    {souGestor && (
                      <button onClick={() => excluir(c.id)} style={botaoExcluir}>
                        Excluir contrato
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}

/* ═══════════ Aba 3 — Estoque de Comodatos ═══════════ */

function AbaEstoque({ setErro, setSouGestor, souGestor }: AbaProps) {
  const [itens, setItens] = useState<EstoqueComodato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [peca, setPeca] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [obs, setObs] = useState("");
  // Anexos (áudio do Mateus, 27/08/2026): documento com o código da peça, foto da peça.
  const [fotosNovas, setFotosNovas] = useState<File[]>([]);
  const [documentosNovos, setDocumentosNovos] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);

  // Edição (áudio do Mateus, 25/08/2026) + aba Excluídos.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ed, setEd] = useState({ codigo: "", peca: "", quantidade: "", obs: "" });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/estoque-comodatos");
      const d = await r.json();
      if (!r.ok) throw new Error(mensagemErro(d, "Falha ao carregar o estoque."));
      setErro(null);
      setItens(d.itens);
      setSouGestor(d.souGestor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o estoque.");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(carregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lancar(e: FormEvent) {
    e.preventDefault();
    const qtd = Number(quantidade);
    if (!codigo.trim() || !peca.trim() || !Number.isInteger(qtd) || qtd < 0) {
      setErro("Preencha código, peça e uma quantidade válida.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/estoque-comodatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim(), peca: peca.trim(), quantidade: qtd, obs: obs.trim() || null }),
      });
      const criado = await r.json();
      if (!r.ok) throw new Error(mensagemErro(criado, "Falha ao lançar o item."));
      const falhas = await enviarAnexos("estoque", criado.id, fotosNovas, documentosNovos);
      if (falhas.length > 0) setErro(`Item lançado, mas alguns anexos falharam: ${falhas.join(", ")}.`);
      setCodigo("");
      setPeca("");
      setQuantidade("");
      setObs("");
      setFotosNovas([]);
      setDocumentosNovos([]);
      setInputKey((k) => k + 1);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao lançar o item.");
    } finally {
      setEnviando(false);
    }
  }

  async function salvarEdicao(id: string) {
    const qtd = Number(ed.quantidade);
    if (!ed.codigo.trim() || !ed.peca.trim() || !Number.isInteger(qtd) || qtd < 0) {
      setErro("Preencha código, peça e uma quantidade válida.");
      return;
    }
    setSalvandoEdicao(true);
    setErro(null);
    try {
      const r = await fetch(`/api/estoque-comodatos?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: ed.codigo.trim(), peca: ed.peca.trim(), quantidade: qtd, obs: ed.obs.trim() || null }),
      });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao editar o item."));
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao editar o item.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  // Excluir é só do gestor; o item vai para a aba Excluídos (restaurável).
  async function excluir(id: string) {
    if (!window.confirm("Excluir este lançamento? Ele vai para a aba Excluídos.")) return;
    try {
      const r = await fetch(`/api/estoque-comodatos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(mensagemErro(await r.json(), "Falha ao excluir o item."));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir o item.");
    }
  }

  // "Esse é importante a gente exportar para Excel" — CSV com BOM (o Excel pt-BR abre
  // direto, acentos corretos), mesmo caminho data:text/csv das exportações existentes.
  function exportar() {
    const cel = (v: string | number | null) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [
      ["Código", "Peça em estoque", "Quantidade", "OBS", "Lançado por", "Lançado em"].join(";"),
      ...itens.map((i) =>
        [cel(i.codigo), cel(i.peca), i.quantidade, cel(i.obs), cel(autorLabel(i)), new Date(i.criadoEm).toLocaleString("pt-BR")].join(";"),
      ),
    ];
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8,﻿" + encodeURIComponent(linhas.join("\n"));
    a.download = "estoque-comodatos.csv";
    a.click();
  }

  const cols = "110px 1fr 90px 1.2fr 170px";

  return (
    <>
      <form onSubmit={lancar} style={cardStyle}>
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: "110px" }}>
              Código
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Código" maxLength={60} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 2, minWidth: "200px" }}>
              Peça em estoque
              <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Nome da peça" maxLength={200} value={peca} onChange={(e) => setPeca(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: "110px" }}>
              Quantidade
              <input
                type="number"
                min={0}
                step={1}
                style={{ ...inputStyle, marginTop: "5px" }}
                placeholder="0"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </label>
          </div>
          <label style={labelStyle}>
            OBS
            <input style={{ ...inputStyle, marginTop: "5px" }} placeholder="Observação (opcional)" maxLength={4000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <CampoAnexos fotos={fotosNovas} setFotos={setFotosNovas} documentos={documentosNovos} setDocumentos={setDocumentosNovos} inputKey={inputKey} />
          <button type="submit" disabled={enviando} style={botaoPrimario(enviando)}>
            {enviando ? "Lançando…" : "Lançar no estoque"}
          </button>
        </div>
      </form>

      {mostrarExcluidos && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <BotaoExcluidos ativo onClick={() => setMostrarExcluidos(false)} />
          </div>
          <BlocoExcluidos<EstoqueComodato>
            endpoint="/api/estoque-comodatos"
            chave="itens"
            setErro={setErro}
            aoMudar={carregar}
            render={(i) => (
              <span style={{ fontSize: "13px", color: "var(--gray-700)" }}>
                <b>{i.codigo}</b> · {i.peca} · Qtd: {i.quantidade}
                {souGestor ? ` · ${autorLabel(i)}` : ""}
              </span>
            )}
          />
        </div>
      )}
      {!mostrarExcluidos && (
      <>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px" }}>
          {souGestor ? "Todos os lançamentos" : "Meus lançamentos"} · {itens.length}
        </div>
        {souGestor && <BotaoExcluidos ativo={false} onClick={() => setMostrarExcluidos(true)} />}
        <button
          onClick={exportar}
          disabled={itens.length === 0}
          style={{
            marginLeft: "auto",
            padding: "7px 15px",
            borderRadius: "999px",
            border: "1px solid var(--blue-600)",
            background: "white",
            color: "var(--blue-600)",
            fontSize: "12.5px",
            fontWeight: 600,
            cursor: itens.length === 0 ? "default" : "pointer",
            opacity: itens.length === 0 ? 0.5 : 1,
          }}
        >
          Exportar para Excel
        </button>
      </div>

      {carregando && <div style={{ color: "var(--gray-500)", fontSize: "14px" }}>Carregando…</div>}
      {!carregando && itens.length === 0 && <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>Nenhum lançamento ainda.</div>}
      {itens.length > 0 && (
        <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", overflowX: "auto" }}>
          <div style={{ minWidth: "620px" }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: "10px", padding: "11px 18px", borderBottom: "1px solid var(--gray-200)", fontSize: "11px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px" }}>
              <span>Código</span>
              <span>Peça</span>
              <span>Qtd.</span>
              <span>OBS</span>
              <span />
            </div>
            {itens.map((i) =>
              editandoId === i.id ? (
                <div key={i.id} style={{ display: "grid", gridTemplateColumns: cols, gap: "10px", padding: "11px 18px", borderBottom: "1px solid var(--gray-100)", fontSize: "13.5px", alignItems: "center" }}>
                  <input style={inputStyle} maxLength={60} value={ed.codigo} onChange={(e) => setEd({ ...ed, codigo: e.target.value })} />
                  <input style={inputStyle} maxLength={200} value={ed.peca} onChange={(e) => setEd({ ...ed, peca: e.target.value })} />
                  <input type="number" min={0} step={1} style={inputStyle} value={ed.quantidade} onChange={(e) => setEd({ ...ed, quantidade: e.target.value })} />
                  <input style={inputStyle} maxLength={4000} value={ed.obs} onChange={(e) => setEd({ ...ed, obs: e.target.value })} />
                  <span style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                    <button onClick={() => salvarEdicao(i.id)} disabled={salvandoEdicao} style={botaoEditar}>
                      {salvandoEdicao ? "…" : "Salvar"}
                    </button>
                    <button onClick={() => setEditandoId(null)} style={{ ...botaoEditar, borderColor: "var(--gray-200)", color: "var(--gray-500)" }}>
                      Cancelar
                    </button>
                  </span>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <BlocoAnexos tipo="estoque" registroId={i.id} anexos={i.anexos} editavel aoMudar={carregar} setErro={setErro} />
                  </div>
                </div>
              ) : (
                <div key={i.id} style={{ display: "grid", gridTemplateColumns: cols, gap: "10px", padding: "11px 18px", borderBottom: "1px solid var(--gray-100)", fontSize: "13.5px", color: "var(--gray-700)", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--gray-900)" }}>{i.codigo}</span>
                  <span>{i.peca}</span>
                  <span>{i.quantidade}</span>
                  <span style={{ color: "var(--gray-500)" }}>{i.obs ?? ""}</span>
                  <span style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                    <BotaoPdf tipo="estoque" id={i.id} />
                    <button
                      onClick={() => {
                        setEditandoId(i.id);
                        setEd({ codigo: i.codigo, peca: i.peca, quantidade: String(i.quantidade), obs: i.obs ?? "" });
                        setErro(null);
                      }}
                      style={botaoEditar}
                    >
                      Editar
                    </button>
                    {/* Excluir é só do gestor — o vendedor só edita (áudio 25/08/2026). */}
                    {souGestor && (
                      <button onClick={() => excluir(i.id)} style={botaoExcluir}>
                        Excluir
                      </button>
                    )}
                  </span>
                  {i.anexos.length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <BlocoAnexos tipo="estoque" registroId={i.id} anexos={i.anexos} editavel={false} aoMudar={carregar} setErro={setErro} />
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}
      </>
      )}
    </>
  );
}
