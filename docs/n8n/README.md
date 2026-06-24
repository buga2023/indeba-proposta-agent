# Referências de estilo (Google Drive → posts)

Faz o agente de posts gerar no **estilo das suas referências**: o vendedor coloca posts de
referência (imagem + legenda) numa pasta do Drive; um modelo de visão local descreve o
**estilo visual** de cada imagem e destila num descritor que substitui o `ESTILO_INDEBA`
fixo; as legendas viram exemplos de tom (few-shot).

## Fluxo

```
Pasta no Drive (imagens + legendas)
  → n8n (lista, baixa, base64)
  → POST /api/referencias/sync
  → qwen2.5vl descreve o estilo de cada imagem
  → síntese num descritor único (inglês, p/ Flux)
  → salva data/referencias/perfil-estilo.json
  → gerar-instagram.ts lê o perfil em toda geração
```

## Passo a passo (manual — precisa da sua conta Google)

1. **Crie a pasta no Google Drive** e suba os posts de referência.
   - A **imagem** é o que conta (o estilo visual sai dela).
   - A **legenda**: cole no campo **Descrição** do arquivo no Drive (clique no arquivo →
     painel de detalhes → Descrição). O workflow lê dali.
   - Pegue o **ID da pasta** da URL: `drive.google.com/drive/folders/<ESTE_ID>`.

2. **No n8n**: importe `docs/n8n/referencias-drive-sync.json` (Workflows → ⋯ → Import from File).

3. Configure a **credencial Google Drive OAuth2** (Credentials → New → Google Drive OAuth2)
   e selecione-a nos dois nós "Drive". *(Isto é seu — eu não tenho acesso à sua conta.)*

4. O ID da pasta **já está preenchido** (`1ozIa5X5GDUm_8UDFkaoJodhpV3rw6lcN`). Só troque
   se mudar de pasta. Garanta que a conta da credencial OAuth tem acesso a ela.

5. URL no nó **"POST /api/referencias/sync"**: como o n8n roda em **container**, está como
   `http://host.docker.internal:3000` (alcança o app Next no host pelo Docker Desktop).
   Se o app rodar noutra máquina, troque pela URL dele na LAN.

6. **Execute** o workflow ("Disparar manualmente"). Ao terminar, confira o resultado:
   `GET http://localhost:3000/api/referencias/sync` deve devolver o perfil derivado.

7. Gere posts normalmente — eles já saem no estilo das referências. Para inspecionar o
   estilo aprendido: abra `data/referencias/perfil-estilo.json`.

## Observações

- **Modelo de visão**: `OLLAMA_MODEL_VISAO` (default `qwen2.5vl:7b`). Roda **local** (Ollama).
- **Produção (Vercel)**: a análise só roda local. Para usar o estilo em prod, **comite**
  o `data/referencias/perfil-estilo.json` gerado — o app o lê em prod (fs read-only, mas a
  leitura funciona).
- **Sem perfil**: a geração cai no `ESTILO_INDEBA` padrão (degradação graciosa).
- Re-rodar o workflow **sobrescreve** o perfil com as referências atuais da pasta.
