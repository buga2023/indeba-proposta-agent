# Como trabalhamos

## O fluxo com o Mateus
1. Mateus manda áudio ou vídeo pelo WhatsApp (Gustavo repassa o arquivo).
2. Transcrever com a skill `transcrever-audio` (whisper local, modelo large).
3. Listar os pedidos, implementar, rodar o portão de qualidade.
4. Commit no padrão `tipo(escopo): pedidos do Mateus DD/MM — resumo`, com comentário no código citando a data do áudio.
5. Push na main (deploy) e verificação em produção.

Linha do tempo em [[Pedidos do Mateus]].

## Regras do projeto (AGENTS.md)
- Seguir a Constitution em `.aiox-core/constitution.md`; CLI first, observabilidade, UI por último.
- Não inventar requisito fora dos artefatos.
- Rodar lint, typecheck e testes antes de concluir.

## Skills disponíveis no repo
- `deploy` · portão local, push, acompanhar build, verificar produção.
- `transcrever-audio` · áudio → transcrição → pedidos → código.

## Convenções de código
- Comentários explicam o **porquê** e citam o pedido (data, quem). O page.tsx é o registro histórico das decisões de UI.
- Contratos Zod em src/lib/contracts são a fonte de tipos; nunca duplicar união à mão.
- Warnings de react-hooks são erro no CI.
