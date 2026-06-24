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

4. No nó **"Drive — listar arquivos da pasta"**, troque `1ABCxyz_TROQUE_PELO_ID_DA_PASTA`
   pelo ID real da pasta.

5. Confirme a URL no nó **"POST /api/referencias/sync"**: `http://localhost:3000` (local)
   ou a URL do app na sua rede.

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
