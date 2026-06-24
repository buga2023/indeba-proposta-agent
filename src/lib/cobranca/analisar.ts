/**
 * Motor de inadimplência DETERMINÍSTICO (porta a planilha de contas a receber → quem deve).
 *
 * §2: nada aqui vem de LLM. Detecta as colunas (cliente/valor/vencimento/status), filtra
 * o que está VENCIDO e EM ABERTO, soma por cliente e calcula o atraso. Sinaliza a lacuna
 * (Dados Primeiro) se faltar coluna de vencimento — não inventa.
 */
import type { SeveridadeCobranca } from "../contracts";
import type { Tabela } from "../financeiro/ingest";
import { fmt } from "../financeiro/engine";

export type InadimplenteBase = {
  cliente: string;
  valorDevido: string;
  titulos: number;
  vencimentoMaisAntigo: string;
  diasAtraso: number;
  severidade: SeveridadeCobranca;
  email: string | null; // capturado da planilha (coluna e-mail), se houver
};

export type ResultadoCobranca = {
  inadimplentes: InadimplenteBase[];
  totalDevido: string;
  aviso: string | null;
};

/** Texto de data BR/ISO → 'YYYY-MM-DD' (ou null). Aceita 2026-01-15 e 15/01/2026. */
export function parseData(s: string): string | null {
  const v = String(s).trim();
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  if ((m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/))) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** Dias de `a` até `b` (ambos 'YYYY-MM-DD'). */
function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function ehPago(s: string): boolean {
  const v = s.toLowerCase();
  if (/n[ãa]o|aberto|pendente|atras|vencid|devid/.test(v)) return false;
  return /pag|quit|liquid|receb|baix/.test(v);
}

function severidade(dias: number): SeveridadeCobranca {
  if (dias <= 30) return "leve";
  if (dias <= 60) return "media";
  return "grave";
}

function colObj(t: Tabela, re: RegExp): string | undefined {
  return t.colunas.find((c) => !t.numericas.has(c) && re.test(c));
}

function parecData(t: Tabela, col: string): boolean {
  const amostra = t.linhas.slice(0, 20).map((r) => String(r[col] ?? ""));
  const ok = amostra.filter((v) => parseData(v)).length;
  return amostra.length > 0 && ok / amostra.length >= 0.6;
}

function num(linha: Record<string, string | number>, col: string): number {
  const v = linha[col];
  return typeof v === "number" ? v : 0;
}

export function analisarInadimplencia(t: Tabela, hoje: string): ResultadoCobranca {
  const vazio = (aviso: string): ResultadoCobranca => ({ inadimplentes: [], totalDevido: "0.00", aviso });

  const colCliente = colObj(t, /cliente|sacado|devedor|raz|nome|empresa|fornecedor/) ?? colObj(t, /.*/);
  const colVenc = t.colunas.find((c) => /venc|due/.test(c)) ?? t.colunas.find((c) => !t.numericas.has(c) && parecData(t, c));
  const colValor =
    t.colunas.find((c) => t.numericas.has(c) && /valor|total|montante|debito|saldo|divida|titulo/.test(c)) ??
    [...t.numericas][0];
  const colStatus = t.colunas.find((c) => /status|situa|pagamento|pago/.test(c));
  const colEmail = colObj(t, /e-?mail/);

  if (!colVenc) return vazio("Não encontrei a coluna de VENCIMENTO — sem ela não dá pra saber o que está vencido. Inclua uma coluna de vencimento (ex.: 2026-01-15).");
  if (!colCliente) return vazio("Não encontrei a coluna de CLIENTE para agrupar as dívidas.");
  if (!colValor) return vazio("Não encontrei a coluna de VALOR dos títulos.");

  type Acc = { soma: number; titulos: number; venc: string; email: string | null };
  const porCliente = new Map<string, Acc>();
  for (const r of t.linhas) {
    const venc = parseData(String(r[colVenc] ?? ""));
    if (!venc) continue;
    if (colStatus && ehPago(String(r[colStatus] ?? ""))) continue; // já pago
    if (diasEntre(venc, hoje) <= 0) continue; // ainda não venceu

    const cliente = String(r[colCliente] ?? "—").trim() || "—";
    const a = porCliente.get(cliente) ?? { soma: 0, titulos: 0, venc, email: null };
    a.soma += num(r, colValor);
    a.titulos += 1;
    if (venc < a.venc) a.venc = venc; // mais antigo
    if (!a.email && colEmail) {
      const e = String(r[colEmail] ?? "").trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) a.email = e;
    }
    porCliente.set(cliente, a);
  }

  const inadimplentes: InadimplenteBase[] = [...porCliente.entries()]
    .map(([cliente, a]) => {
      const dias = diasEntre(a.venc, hoje);
      return {
        cliente,
        valorDevido: a.soma.toFixed(2),
        titulos: a.titulos,
        vencimentoMaisAntigo: a.venc,
        diasAtraso: dias,
        severidade: severidade(dias),
        email: a.email,
      };
    })
    .sort((x, y) => Number(y.valorDevido) - Number(x.valorDevido));

  const totalDevido = inadimplentes.reduce((s, i) => s + Number(i.valorDevido), 0).toFixed(2);
  const aviso = !colStatus
    ? "Sem coluna de STATUS: considerei EM ABERTO todos os títulos vencidos. Inclua um status (pago/em aberto) para mais precisão."
    : null;

  return { inadimplentes, totalDevido, aviso };
}

/** Substitui os placeholders do template da régua pelos valores DO MOTOR (§2). */
export function preencherMensagem(template: string, i: InadimplenteBase): string {
  return template
    .replaceAll("{cliente}", i.cliente)
    .replaceAll("{valor}", `R$ ${fmt(Number(i.valorDevido))}`)
    .replaceAll("{dias}", String(i.diasAtraso));
}
