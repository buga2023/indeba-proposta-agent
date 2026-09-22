# Ambiente local

Esta máquina (Windows) **não tem Postgres nem Docker**. Para ver telas sem banco:
```
AUTH_ENABLED=false DATABASE_URL="postgresql://x:x@127.0.0.1:5432/x" npx next dev -H 127.0.0.1 -p 3123
```
As listas mostram erro HTTP 500 (sem banco), mas layout, navegação e celular dão para conferir.

## Prints em celular
Script de exemplo em `apresentacao/.build/mobile-shots.mjs` (ignorado pelo git): Playwright com viewport 390x844, abre o menu, entra em cada tela e mede `scrollWidth` (tem que ser 390, sem rolagem lateral).

## Ferramentas fora do repo
- ffmpeg e whisper.cpp em `~/.claude/tools/whisper/` (modelo large-v3-turbo) para transcrever áudios e vídeos do WhatsApp.
- msedge-tts (npm) para narração em português (voz Thalita).
- Chrome com a extensão Claude para testar produção logado.

Arquivos CRLF: page.tsx, globals.css, middleware e next.config usam CRLF. Scripts que fazem replace de texto precisam normalizar.
