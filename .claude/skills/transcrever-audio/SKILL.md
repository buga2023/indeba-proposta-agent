---
name: transcrever-audio
description: Transcreve áudios (WhatsApp .opus/.ogg, .mp3, .m4a, .wav, vídeos) do Mateus/Indeba usando whisper.cpp local, interpreta o pedido em português e executa as alterações pedidas no projeto. Usar quando o usuário mandar um arquivo de áudio, disser "áudio do Mateus", "transcreve" ou pedir para ouvir/atender um áudio.
---

# Transcrever áudio e executar o pedido

Fluxo: transcrever o áudio localmente com whisper.cpp → mostrar a transcrição ao usuário → interpretar o que foi pedido → implementar no projeto.

## Ferramentas

Binários ficam em `C:\Users\Administrador\.claude\tools\whisper\`:
- `whisper-cli.exe` (whisper.cpp)
- `ggml-*.bin` (modelo multilíngue — NUNCA usar modelo `.en`, os áudios são em português)
- ffmpeg no PATH (instalado via winget)

Se algo faltar, rode o setup: `powershell -File .claude/skills/transcrever-audio/setup.ps1`

## Passo 1 — Localizar o áudio

Se o usuário não deu o caminho, procure arquivos de áudio recentes (`.opus`, `.ogg`, `.mp3`, `.m4a`, `.wav`, `.aac`, `.mp4`) em `~\Downloads`, `~\Desktop` e na pasta do projeto, ordenados por data. Confirme com o usuário se houver ambiguidade.

## Passo 2 — Converter para WAV 16kHz mono

whisper.cpp só aceita WAV 16kHz. Converta no scratchpad:

```powershell
ffmpeg -y -i "<audio>" -ar 16000 -ac 1 -c:a pcm_s16le "<scratchpad>\audio.wav"
```

## Passo 3 — Transcrever

```powershell
& "$env:USERPROFILE\.claude\tools\whisper\whisper-cli.exe" -m "$env:USERPROFILE\.claude\tools\whisper\ggml-small.bin" -l pt -f "<scratchpad>\audio.wav" -otxt -of "<scratchpad>\transcricao"
```

Leia `transcricao.txt`. Se a transcrição sair ruim/truncada, tente o modelo maior se existir (`ggml-medium.bin`).

Vários áudios: transcreva todos em sequência e trate como uma conversa única, em ordem cronológica (data do arquivo).

## Passo 4 — Mostrar e interpretar

1. Mostre a transcrição completa ao usuário (corrigindo mentalmente erros óbvios de reconhecimento: termos do projeto como "Indeba", "proposta", "comodato", "orçamento", nomes de telas).
2. Liste em bullets o que o Mateus pediu, item por item, na sua interpretação.
3. Contexto: Mateus é o cliente da Indeba; os pedidos normalmente são mudanças neste projeto (indeba-proposta-agent — sistema de propostas/orçamentos/ferramentas). Veja commits recentes com "pedidos do Mateus" para o padrão.

## Passo 5 — Executar

Implemente os pedidos no código. Se um pedido for ambíguo ou destrutivo, pergunte antes; caso contrário, execute direto. Ao commitar, siga o padrão existente, ex.: `feat(escopo): pedidos do Mateus DD/MM — resumo`.
