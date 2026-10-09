// Diagnóstico das variáveis de ambiente no boot (revisão de ops, 08/10/2026, item #6).
// `SITE_URL` apontou para um domínio morto por 19 dias e todo PDF saiu com link de ficha
// quebrado sem ninguém notar: cada env era lida crua, pontualmente, em 20 arquivos. Esta
// função não lança nem muda valor nenhum — só devolve avisos legíveis, que o
// instrumentation.ts imprime uma vez por instância. Pura, para ser testável.
export type AvisoEnv = { nivel: "erro" | "aviso"; variavel: string; texto: string };

type Ambiente = Record<string, string | undefined>;

export function diagnosticarEnv(env: Ambiente, opts: { producao: boolean; vercel: boolean }): AvisoEnv[] {
  const avisos: AvisoEnv[] = [];
  const vazio = (k: string) => !env[k] || !String(env[k]).trim();
  const erro = (variavel: string, texto: string) => avisos.push({ nivel: "erro", variavel, texto });
  const aviso = (variavel: string, texto: string) => avisos.push({ nivel: "aviso", variavel, texto });

  // Link "Ver ficha técnica completa" dos PDFs. Sem ela o link some; errada, aponta pro nada.
  if (vazio("SITE_URL")) {
    aviso("SITE_URL", "ausente: o PDF da Proposta de Solução sai sem o link da ficha técnica.");
  } else {
    const v = String(env.SITE_URL).trim();
    if (!/^https?:\/\/[^\s/]+$/i.test(v)) {
      erro("SITE_URL", `"${v}" precisa ser só origem (https://dominio), sem caminho nem barra final — é prefixo de link no PDF.`);
    } else if (opts.vercel && env.VERCEL_PROJECT_PRODUCTION_URL && !v.toLowerCase().includes(String(env.VERCEL_PROJECT_PRODUCTION_URL).toLowerCase())) {
      aviso("SITE_URL", `"${v}" não bate com o domínio de produção da Vercel (${env.VERCEL_PROJECT_PRODUCTION_URL}). Se o projeto foi renomeado, o link da ficha nos PDFs está morto.`);
    }
  }

  if (opts.producao) {
    if (vazio("AUTH_SESSION_SECRET")) erro("AUTH_SESSION_SECRET", "ausente em produção: login não funciona.");
    if (vazio("DATABASE_URL")) erro("DATABASE_URL", "ausente: nada persiste.");
    // Rate limit falha ABERTO sem Upstash (lib/ratelimit.ts) — produção sem ele fica sem proteção.
    if (vazio("UPSTASH_REDIS_REST_URL") || vazio("UPSTASH_REDIS_REST_TOKEN")) {
      aviso("UPSTASH_REDIS_REST_URL", "Upstash ausente: rate limit de login/API desligado e log de PDF só em arquivo efêmero.");
    }
    const smtp = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
    const faltam = smtp.filter(vazio);
    if (faltam.length > 0 && faltam.length < smtp.length) {
      aviso("SMTP_*", `SMTP incompleto (faltam ${faltam.join(", ")}): e-mails de cobrança e contato vão falhar.`);
    }
    if (vazio("INDEBA_WHATSAPP") && vazio("INDEBA_CONSULTOR_EMAIL")) {
      aviso("INDEBA_WHATSAPP", "sem WhatsApp nem e-mail do consultor: a Proposta de Solução sai sem contato no rodapé.");
    }
    if (opts.vercel && vazio("OLLAMA_BASE_URL")) {
      aviso("OLLAMA_BASE_URL", "ausente na Vercel: refino de texto, chat de edição e RAG ficam em modo determinístico/503.");
    }
  }
  return avisos;
}

export function formatarAvisos(avisos: AvisoEnv[]): string[] {
  return avisos.map((a) => `[env] ${a.nivel === "erro" ? "ERRO" : "aviso"} ${a.variavel}: ${a.texto}`);
}
