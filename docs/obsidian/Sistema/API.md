# API

Todas as rotas ficam em `src/app/api/`. O middleware exige sessão em tudo, exceto login, logout e cadastro (ver [[Autenticação e segurança]]). Rate limit por balde: login separado das demais.

## Propostas e catálogo
- `propostas`, `propostas/[id]`, `propostas/lote` · CRUD, status, exclusão em lote
- `montar`, `montar-estruturado` · montagem (IA e determinística)
- `pdf` · render do PDF da proposta (Chromium)
- `catalogo`, `produtos`, `produtos/[codigo]`, `produtos/[codigo]/ficha`, `produtos/[codigo]/imagem`, `produtos/extrair-ficha`
- `textos-padrao`, `refinar-texto`, `comando-edicao`, `orcamento/importar`

## Ferramentas
- `visitas`, `visitas/[id]`, `visitas/[id]/fotos`, `visitas/[id]/documento` · visitas (area comercial ou tecnica)
- `novas-prospeccoes`, `solicitacoes-comerciais`
- `comodatos`, `comodatos/[id]/pdf`, `estoque-comodatos`
- `registros/[tipo]/[id]/pdf` · ficha em PDF de visita, prospecção e solicitação (uma rota só, por causa do tamanho do Chromium na Lambda)
- `anexos`, `anexos/[id]`

## Acesso e sistema
- `login`, `logout`, `cadastro`, `me`, `perfil`, `acessos`, `colaboradores`, `admin-config`, `chamados`, `chamados/[id]`

## Agentes (sem porta no menu)
- `prospectar`, `instagram`, `financeiro`, `cobranca`, `cobranca/disparar`, `compras`, `fiscal`, `contabil`, `contrato`, `contrato/extrair`, `rag`, `feedback`, `referencias/sync`, `contatos`

## Cuidados de deploy
Rotas que renderizam PDF precisam de `outputFileTracingIncludes` no next.config.ts com os binários do Chromium. Chave com segmento dinâmico usa `*`, não `[tipo]` (Turbopack trata colchetes como classe de caracteres).
