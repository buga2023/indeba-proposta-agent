// Roda UMA vez por instância do servidor (convenção do Next). Só imprime o diagnóstico das
// variáveis de ambiente — não lança, não altera nada. Ver lib/env-check.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  const { diagnosticarEnv, formatarAvisos } = await import("./lib/env-check");
  const avisos = diagnosticarEnv(process.env, {
    producao: process.env.NODE_ENV === "production",
    vercel: !!process.env.VERCEL,
  });
  for (const linha of formatarAvisos(avisos)) {
    if (linha.includes(" ERRO ")) console.error(linha);
    else console.warn(linha);
  }
}
