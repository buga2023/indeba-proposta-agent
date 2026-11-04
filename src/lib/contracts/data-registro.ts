import { z } from "zod";

/**
 * Data digitada nos registros das Ferramentas (visitas, prospecções) — áudio do Mateus,
 * 03/11/2026: um vendedor lançou "0026" em vez de 2026 e a pasta "0026" apareceu no
 * calendário. "Só tem como ser 2026 (…) o mês, a data não tem problema, pode deixar
 * destravado, porque às vezes o cara só bota o relatório no outro mês. Mas o ano seria
 * interessante o ano vigente."
 *
 * Regra: o ANO da data tem que ser o ano corrente; dia e mês ficam livres dentro dele.
 * Só o ano é travado — relatório de setembro lançado em outubro continua valendo.
 * `hoje` é injetável para o teste não depender do relógio.
 */
export const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const anoVigente = (hoje: Date = new Date()) => hoje.getFullYear();

/** Mensagem de erro se o ano da data não for o vigente; null quando está certo. */
export function erroAnoDaData(data: string, hoje: Date = new Date()): string | null {
  const m = REGEX_DATA_ISO.exec(data.trim());
  if (!m) return "data no formato AAAA-MM-DD";
  const ano = Number(data.slice(0, 4));
  const vigente = anoVigente(hoje);
  if (ano === vigente) return null;
  return `O ano da data tem que ser ${vigente} (veio ${data.slice(0, 4)}). Confira o ano digitado.`;
}

/** Limites para o <input type="date">: o navegador já barra o ano errado antes do servidor. */
export const limitesDataVigente = (hoje: Date = new Date()) => ({
  min: `${anoVigente(hoje)}-01-01`,
  max: `${anoVigente(hoje)}-12-31`,
});

// Campo compartilhado pelos contratos de criação (e pela edição do gestor). O refine roda
// no campo, então sobrevive a `.omit()`/`.extend()` dos esquemas que o usam.
export const DataRegistro = z
  .string()
  .regex(REGEX_DATA_ISO, "data no formato AAAA-MM-DD")
  .superRefine((data, ctx) => {
    const erro = erroAnoDaData(data);
    if (erro) ctx.addIssue({ code: "custom", message: erro });
  });
