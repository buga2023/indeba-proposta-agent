# Pendências — Gerador de Contratos Indeba Express

Versão 1.0 · 21/09/2026

Legenda: **DEV** = programador · **DONO** = sócio/gestor · **JUR** = advogado

## A. Para subir na plataforma (DEV)

| # | Item | Quem | Onde |
|---|------|------|------|
| 1 | Copiar `public/gerador-contratos/` para a pasta `public/` do repositório da plataforma | DEV | README, seção 2 |
| 2 | Adicionar o rewrite de `/gerador-contratos` (Next.js) e o cabeçalho `no-cache` | DEV | `snippets/next.config.snippet.js` |
| 3 | **Definir e implementar a proteção de acesso** antes de publicar (a pasta `public/` é aberta a qualquer pessoa com o link) | DEV + DONO | README, seção 4; `snippets/middleware.*.ts` |
| 4 | Criar o item de menu / página `Contratos` (link direto ou iframe) | DEV | `snippets/app-contratos-page.tsx` |
| 5 | Conferir cabeçalhos de segurança da plataforma (X-Frame-Options, CSP) se usar iframe | DEV | README, seção 5 |
| 6 | Fazer o deploy e rodar `node tests/smoke.js <URL>`; todos os itens devem sair "OK" | DEV | `tests/smoke.js` |
| 7 | Gerar 1 contrato real de teste e conferir o PDF visualmente (6 páginas em A4) | DEV + DONO | README, seção 8 |

## B. Decisões do dono

| # | Decisão | Observação |
|---|---------|------------|
| 1 | Forma de acesso: senha única, login da plataforma ou proteção da Vercel | README, seção 4 traz prós e contras |
| 2 | Quem pode editar o texto da cláusula 14.2 | Hoje qualquer usuário do gerador edita. Se for restrito, pedir a versão com trava |
| 3 | Título do contrato mencionar o comodato? | Hoje: "Contrato de Fornecimento de Produtos Químicos e Prestação de Serviços de Assistência Técnica". O documento também é o contrato de comodato |
| 4 | Plataforma de assinatura digital a ser usada | Testar o PDF gerado nela. As linhas "Nome/CPF" ficam em branco para preenchimento |
| 5 | Registrar contratos gerados (histórico por cliente)? | Hoje nada é guardado; cada geração é local no navegador |

## C. Revisão jurídica (JUR)

Pontos levantados durante a construção. Nenhum foi alterado sem pedido do dono.

1. **Cláusula 14.2 (rescisão antecipada):** o texto padrão diz que a rescisão antecipada *não* implica ressarcimento; o dono edita por cliente quando quer cobrar. Quando houver cobrança, definir valor ou critério (integral ou proporcional ao prazo restante).
2. **Cláusula 7.7 (consumo mínimo mensal de 50% do investimento):** não prevê consequência se o mínimo não for atingido (cobrança da diferença, rescisão etc.). Exemplo: investimento de R$ 10.328,22 → R$ 5.164,11 por mês.
3. **Cláusulas 13 e 16:** tratam do mesmo assunto (cessão/transferência) e se repetem.
4. **Cláusula 11.1.3:** passou a dizer que a aquisição dos equipamentos será "segundo condições a serem acordadas entre as partes" (antes remetia a contratos de comodato específicos, cláusulas 11.2/11.3, removidas porque este contrato é o próprio comodato). Avaliar se convém fixar critério (por exemplo, valor de mercado).
5. **Cláusulas 2.2 e 4.4:** citam o ANEXO I = proposta comercial já enviada ao cliente. A proposta precisa ser anexada e assinada junto com o contrato (o gerador não produz o anexo).
6. **Prazos coincidentes:** 72 h para suprimento extraordinário (4.3) e 72 h para atendimento técnico emergencial (10.1, contadas da solicitação). Confirmar que a operação cumpre ambos.
7. **Qualificação da contratante:** o contrato traz apenas razão social e CNPJ (sem endereço). Avaliar se convém constar o endereço para fins de notificações (cláusula 14.1).
8. Texto integral vigente em `docs/clausulas-atuais.md`.

## D. Antes de enviar cada contrato (rotina do DONO)

- [ ] Conferir **razão social e CNPJ** no cartão CNPJ do cliente (o gerador avisa se os dígitos verificadores não conferem, mas não confirma que o CNPJ existe).
- [ ] Conferir valor, lista de equipamentos, duração e data.
- [ ] Anexar a proposta comercial (Anexo I).
- [ ] Se a 14.2 foi editada, revisar o texto final na pré-visualização.
