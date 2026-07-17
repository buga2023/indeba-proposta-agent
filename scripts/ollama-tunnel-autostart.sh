#!/bin/bash
# Autostart do backend de IA em produção (Ollama + proxy autenticado + túnel Cloudflare).
# Registrado no Task Scheduler pra rodar no logon do Windows via Git Bash (scripts/registrar-autostart.ps1).
# Idempotente: se já está tudo no ar com a MESMA URL de túnel já configurada na Vercel, não
# faz nada. Se o túnel mudou de URL (reinício do PC/processo), atualiza a env na Vercel E
# redeploya — mudar env var sozinha NÃO basta, a Vercel injeta env no build/deploy, não em
# runtime já publicado.
set -uo pipefail

PROJ="/c/Users/gusta/OneDrive/Imagens/Documentos/Projects/Agente de Proposta - INDEBA"
LOG="$PROJ/scripts/autostart.log"
STATE="$PROJ/scripts/.ollama-tunnel-url"
CF="/c/Users/gusta/AppData/Local/Microsoft/WinGet/Packages/Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe/cloudflared.exe"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

cd "$PROJ" || exit 1
log "=== autostart iniciado ==="

# 1) Ollama serve
if ! tasklist //FI "IMAGENAME eq ollama.exe" 2>/dev/null | grep -qi ollama.exe; then
  log "Ollama não estava rodando — iniciando..."
  nohup "$LOCALAPPDATA/Programs/Ollama/ollama.exe" serve > /dev/null 2>&1 &
  disown
  sleep 5
else
  log "Ollama já rodando."
fi

# 2) Proxy autenticado (porta 11435) — token vem do .env.local
if ! netstat -ano | grep ":11435" | grep -q LISTENING; then
  log "Proxy (11435) não estava rodando — iniciando..."
  TOKEN=$(grep "^OLLAMA_AUTH_TOKEN=" .env.local | cut -d= -f2-)
  if [ -z "$TOKEN" ]; then log "ERRO: OLLAMA_AUTH_TOKEN não encontrado em .env.local — abortando."; exit 1; fi
  nohup env OLLAMA_AUTH_TOKEN="$TOKEN" node scripts/ollama-proxy.mjs > /tmp/ollama-proxy.log 2>&1 &
  disown
  sleep 2
else
  log "Proxy já rodando."
fi

# 3) Túnel Cloudflare (aponta pro proxy, NUNCA direto pro Ollama)
if ! tasklist //FI "IMAGENAME eq cloudflared.exe" 2>/dev/null | grep -qi cloudflared.exe; then
  log "Túnel não estava rodando — iniciando..."
  rm -f cf.log
  nohup "$CF" tunnel --url http://127.0.0.1:11435 --http-host-header localhost:11435 --logfile cf.log > /dev/null 2>&1 &
  disown
  sleep 8
else
  log "Túnel já rodando."
fi

# 4) Descobre a URL atual do túnel (log novo se acabamos de iniciar; senão reaproveita
#    a última URL conhecida, já que o túnel seguiu vivo desde a última sincronização).
NOVA_URL=""
if [ -f cf.log ]; then
  NOVA_URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" cf.log | head -1)
fi
if [ -z "$NOVA_URL" ] && [ -f "$STATE" ]; then
  NOVA_URL=$(cat "$STATE")
fi
if [ -z "$NOVA_URL" ]; then
  log "ERRO: não consegui determinar a URL do túnel."
  exit 1
fi

URL_ANTERIOR=""
[ -f "$STATE" ] && URL_ANTERIOR=$(cat "$STATE")

if [ "$NOVA_URL" = "$URL_ANTERIOR" ]; then
  log "URL do túnel sem mudança ($NOVA_URL) — nada a fazer na Vercel."
  log "=== autostart concluído (sem deploy) ==="
  exit 0
fi

log "URL do túnel mudou: '$URL_ANTERIOR' -> '$NOVA_URL'. Atualizando Vercel + redeploy..."
echo -n "$NOVA_URL" > "$STATE"

vercel env rm OLLAMA_BASE_URL production -y >> "$LOG" 2>&1
printf '%s' "$NOVA_URL" | vercel env add OLLAMA_BASE_URL production >> "$LOG" 2>&1

vercel --prod --yes > deploy-autostart.log 2>&1
log "Deploy disparado. Log em deploy-autostart.log"
log "=== autostart concluído (com deploy) ==="
