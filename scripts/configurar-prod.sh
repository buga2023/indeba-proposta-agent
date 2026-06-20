#!/usr/bin/env bash
# Seta as variáveis de produção que faltam (Ollama + Upstash) e redeploya.
#
# Uso (no Git Bash):
#   bash scripts/configurar-prod.sh <OLLAMA_URL> [UPSTASH_URL] [UPSTASH_TOKEN]
#
# Ex.: bash scripts/configurar-prod.sh https://abc.trycloudflare.com
#      bash scripts/configurar-prod.sh https://abc.trycloudflare.com https://xxx.upstash.io AX...token
#
# Pré-requisito: já estar logado na Vercel (vercel login) e o projeto linkado.
set -e

OLLAMA_URL="$1"; UPSTASH_URL="$2"; UPSTASH_TOKEN="$3"
if [ -z "$OLLAMA_URL" ]; then
  echo "ERRO: faltou a URL do túnel do Ollama."
  echo "Uso: bash scripts/configurar-prod.sh <OLLAMA_URL> [UPSTASH_URL] [UPSTASH_TOKEN]"
  exit 1
fi

# Idempotente: remove a env se já existir, depois adiciona o valor novo.
set_env() {
  vercel env rm "$1" production -y >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production
}

echo "→ OLLAMA_BASE_URL"
set_env OLLAMA_BASE_URL "$OLLAMA_URL"
echo "→ OLLAMA_MODEL"
set_env OLLAMA_MODEL "qwen2.5:7b-instruct"

if [ -n "$UPSTASH_URL" ] && [ -n "$UPSTASH_TOKEN" ]; then
  echo "→ UPSTASH_REDIS_REST_URL"
  set_env UPSTASH_REDIS_REST_URL "$UPSTASH_URL"
  echo "→ UPSTASH_REDIS_REST_TOKEN"
  set_env UPSTASH_REDIS_REST_TOKEN "$UPSTASH_TOKEN"
  echo "Rate limit: ATIVADO (Upstash)."
else
  echo "Rate limit: pulado (sem Upstash). Rode de novo com URL+TOKEN para ativar."
fi

echo "→ Redeployando produção..."
vercel --prod --yes
echo "Pronto. Acesse https://indeba-propostas-agent.vercel.app"
