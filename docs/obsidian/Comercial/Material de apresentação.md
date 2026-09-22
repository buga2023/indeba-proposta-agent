# Material de apresentação

Pasta `apresentacao/` no repo. Saídas em Downloads.

| Arquivo | O que é |
|---|---|
| Indeba_Express_Apresentacao.mp4 | 2min53, 14 slides, prints reais de produção, narração pt-BR (voz Thalita, msedge-tts), legenda |
| Indeba_Express_Apresentacao.pdf | mesmos 14 slides, sem legenda |
| Indeba_Express_Planos_e_Regras.pdf | 5 páginas A4, planos e regras ([[Planos e regras]]) |

## Como regerar
- Deck: `apresentacao/index.html` (slides; narração no atributo `data-narracao` de cada slide). Abre no navegador como apresentação (setas, F para tela cheia).
- Vídeo e PDF: `npm i msedge-tts` uma vez, depois `node apresentacao/build.mjs`. Captura cada slide com Playwright, gera a voz, monta o MP4 com ffmpeg (zoom suave, crossfade) e exporta o PDF.
- Planos: `node apresentacao/.build/pdf-planos.mjs` (ou qualquer render de `planos.html` em A4).
- Prints reais: `apresentacao/prints/` (capturados logado como Mateus em 22/09). Contêm nomes de clientes reais; avaliar borrar antes de mostrar a terceiros.

## Voz
Vozes gratuitas em português: Antonio, Francisca, Thalita (a mais natural). Se ainda soar artificial, usar voz paga (ElevenLabs) ou gravação humana encaixada por slide.

Histórico: o material anterior (Video_Sistema_Indeba_dublado.mp4, Sistema_Propostas_Indeba.pdf) era para a direção da Indeba e falava só de propostas com IA; foi substituído em 21/09.
