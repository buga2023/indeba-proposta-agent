/**
 * Camada de ingestão — carrega e normaliza planilhas (porta `src/ingest.py`).
 *
 * Lida com formato monetário brasileiro ('R$ 1.234,56', '1.234,56', '1234.56') e
 * normaliza nomes de coluna. Nenhuma lógica de negócio aqui — só entrada confiável.
 * MVP: CSV (delimitador ; ou , detectado). XLSX fica como extensão (precisaria de SheetJS).
 */

// Uma tabela já normalizada: colunas (nomes sem acento), linhas como objetos, e o
// conjunto de colunas detectadas como numéricas (já convertidas para number).
export type Tabela = {
  colunas: string[];
  numericas: Set<string>;
  linhas: Array<Record<string, string | number>>;
};

function semAcento(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function normalizarNome(col: string): string {
  // 'Valor Total (R$)' -> 'valor_total_r'
  const s = semAcento(String(col))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "coluna";
}

/** Converte texto monetário BR para number. Trata milhar '.', decimal ',', R$ e negativos. */
export function parseBrl(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isNaN(v) ? 0 : v;

  let s = String(v).trim().replace(/R\$/g, "").replace(/ /g, " ").trim().replace(/ /g, "");
  if (["", "-", "--", "nan", "none"].includes(s.toLowerCase())) return 0;

  const neg = s.startsWith("-") || s.startsWith("(");
  s = s.replace(/^[(]+|[)]+$/g, "").replace(/^-+/, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // 1.234,56 -> 1234.56
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // 1234,56 -> 1234.56
    s = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length > 2) {
      // 1.234.567 -> milhar
      s = s.replace(/\./g, "");
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      // 1.000 -> milhar (heurística BR)
      s = s.replace(/\./g, "");
    }
    // senão: trata '.' como decimal (12.50, 1.5)
  }

  s = s.replace(/[^\d.]/g, "");
  if ((s.match(/\./g)?.length ?? 0) > 1) {
    // segurança: mantém só o último ponto como decimal
    const i = s.lastIndexOf(".");
    s = s.slice(0, i).replace(/\./g, "") + "." + s.slice(i + 1);
  }
  const val = s ? Number(s) : 0;
  const num = Number.isNaN(val) ? 0 : val;
  return neg ? -num : num;
}

const RE_NUM = /^[\sR$().,\-\d]+$/;
const RE_DATA = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;

function pareceNumerica(valores: string[]): boolean {
  const amostra = valores.filter((v) => v.trim() !== "").slice(0, 25);
  if (amostra.length === 0) return false;
  // Se metade ou mais parece data, NÃO é coluna numérica (não converte datas).
  if (amostra.filter((v) => RE_DATA.test(v.trim())).length / amostra.length >= 0.5) return false;
  const ok = amostra.filter((v) => RE_NUM.test(v.trim())).length;
  return ok / amostra.length >= 0.8;
}

/** Detecta o delimitador do CSV pela linha de cabeçalho (; tem prioridade no BR). */
function detectarDelimitador(cabecalho: string): string {
  const candidatos = [";", "\t", ","];
  let melhor = ";";
  let max = -1;
  for (const d of candidatos) {
    const n = cabecalho.split(d).length - 1;
    if (n > max) {
      max = n;
      melhor = d;
    }
  }
  return max > 0 ? melhor : ",";
}

/** Parser CSV minimalista com suporte a aspas e ao delimitador detectado. */
function parseCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const primeiraLinha = limpo.slice(0, limpo.indexOf("\n") >= 0 ? limpo.indexOf("\n") : undefined);
  const delim = detectarDelimitador(primeiraLinha);

  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          aspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === delim) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/** Lê um CSV (texto), normaliza colunas e converte as colunas numéricas (formato BR). */
export function carregarCsv(texto: string): Tabela {
  const grade = parseCsv(texto);
  if (grade.length === 0) return { colunas: [], numericas: new Set(), linhas: [] };

  const colunas = grade[0].map(normalizarNome);
  const brutas: string[][] = grade.slice(1);

  // Detecta quais colunas são numéricas a partir dos valores crus.
  const numericas = new Set<string>();
  colunas.forEach((col, idx) => {
    const valores = brutas.map((r) => r[idx] ?? "");
    if (pareceNumerica(valores)) numericas.add(col);
  });

  const linhas = brutas.map((r) => {
    const obj: Record<string, string | number> = {};
    colunas.forEach((col, idx) => {
      const cru = r[idx] ?? "";
      obj[col] = numericas.has(col) ? parseBrl(cru) : cru;
    });
    return obj;
  });

  return { colunas, numericas, linhas };
}
