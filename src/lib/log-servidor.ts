// Aviso de DEGRADAÇÃO em uma linha JSON (revisão de ops, 08/10/2026, item #7). Os
// `console.error(texto, e)` soltos nos caminhos "banco fora → serve o JSON" eram invisíveis
// nos logs da Vercel: várias linhas, sem campo para filtrar. Com `tag: "degradacao"` dá para
// contar quantas vezes por hora o sistema caiu no plano B — e isso virar alerta.
export function avisarDegradacao(origem: string, mensagem: string, causa?: unknown, extra?: Record<string, unknown>) {
  const err = causa instanceof Error ? causa : null;
  console.warn(
    JSON.stringify({
      nivel: "warn",
      tag: "degradacao",
      origem,
      mensagem,
      ...(causa !== undefined ? { erro: err ? err.name : typeof causa, detalhe: err ? err.message : String(causa).slice(0, 500) } : {}),
      ...(extra ?? {}),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      ts: new Date().toISOString(),
    }),
  );
}
