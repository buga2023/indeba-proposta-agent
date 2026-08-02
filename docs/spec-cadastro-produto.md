# Cadastro de produto pela interface — 01/08/2026

O botão "Novo produto" existia desabilitado desde o MVP (*"em breve"*). O Mateus pediu no
vídeo de validação: *"nas configurações depois você vai abrir a questão de adicionar produto"*.

## Por que não era só um formulário

Duas paredes, ambas de infraestrutura:

1. **`data/catalogo.json` é arquivo versionado, e a função da Vercel é somente-leitura.**
   `carregarCatalogo()` lê do disco e memoiza. Em produção não há como gravar nele.
2. **A ficha técnica é um PDF de verdade** (147 arquivos em `public/fichas-tecnicas/`, até
   ~700 KB). Upload para `public/` tem o mesmo problema.

Cadastrar produto não é uma tela — é decidir onde o catálogo passa a morar.

## Caminho escolhido: híbrido (B)

Os 150 produtos continuam no JSON; **produto novo nasce no Postgres**. `carregarCatalogo()`
passa a unir as duas fontes. Entrega o cadastro sem parar tudo para migrar, e a migração
completa vira um passo seguinte, quando já houver produtos no banco para migrar junto.

### Storage: bytes no Postgres, não em serviço novo

Foto e ficha vão como `Bytes` na própria linha do produto. Não é a solução de um catálogo de
milhares de itens — mas para dezenas de produtos novos (~1 MB cada) o Postgres dá conta, e
evita provisionar Vercel Blob só para isso. Se o volume crescer, a troca é local: só o
`ProdutoCustom` e as duas rotas que servem os bytes precisam mudar.

Produto do banco recebe caminhos servidos por rota:

```
imagemPath       = /api/produtos/<codigo>/imagem
fichaTecnicaPath = /api/produtos/<codigo>/ficha
```

Assim `<img src>` na tela e o link da ficha funcionam sem o arquivo existir em `public/`.

### O ponto sensível: `carregarCatalogo()` é síncrono

Sete módulos dependem dele (`montar.ts`, `api/catalogo`, `rag/indexar`, `propostas.ts`,
`api/refinar-texto`, `api/orcamento/importar`, `api/comando-edicao`), e ler do banco é
assíncrono. A saída é **não mexer no síncrono**: ele continua servindo o JSON (caminho
quente, usado em loop), e entra um `catalogoCompleto()` assíncrono que une JSON + banco,
adotado nos sete pontos — todos já em contexto assíncrono.

`comImagensDoCatalogo()` (em `propostas.ts`) é o único caso que exige atenção: hoje é
síncrono dentro de `mapearRegistro`. Vira assíncrono e sobe até `listarPropostas`/
`obterProposta`, que já são `async`.

### PDF

`render.ts` resolve imagem por `readFileSync` em `public/` (`dentroDePublic`). Um produto do
banco cairia na arte genérica. A resolução passa a reconhecer `/api/produtos/<codigo>/imagem`
e ler os bytes do Postgres — o PDF é montado no servidor, então tem acesso direto.

### Permissão

Mesma do painel de acessos: **só gestor**. Reusa `usuarioAtual` + checagem de `papel`,
como `/api/colaboradores`. O botão "Novo produto" só habilita para admin.

## Escopo

- Modelo `ProdutoCustom` + migration (sem tocar em `Usuario`/`Proposta`)
- `POST /api/produtos` (admin), `GET` para listar, `DELETE` para remover
- `GET /api/produtos/<codigo>/imagem` e `/ficha` — servem os bytes
- `catalogoCompleto()` unindo as fontes; sete call sites migrados
- `render.ts` resolvendo imagem do banco
- Formulário na tela de Catálogo, cobrindo **a ficha rica também** (benefícios, diluições,
  características) — sem isso o produto novo sai com página pobre no PDF, virando produto de
  segunda classe no catálogo
- Testes-guardiões + smoke test de ponta a ponta

## Fora de escopo

- Edição de produto do JSON pela tela (só os novos, do banco, são editáveis/removíveis)
- Migração dos 150 para o banco
- Recorte automático de fundo (`gerar-cutouts.mjs`) para foto enviada pela tela
