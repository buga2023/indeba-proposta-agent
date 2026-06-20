# Indeba Proposta Agent

Gerador de propostas comerciais em PDF para a Indeba. A partir de um briefing em
linguagem natural — ou de itens informados diretamente — o sistema seleciona os
produtos do catálogo, escreve o texto de apresentação e renderiza a proposta no
padrão visual da Indeba.

O preço, a imagem, a embalagem e a ficha de cada item vêm **sempre do catálogo**:
a seleção e o texto são sugeridos, mas nenhum dado crítico é fabricado.

## Tipos de proposta

O tipo é detectado pelo prompt; em caso de dúvida, o sistema pergunta antes de gerar.

- **Orçamento** — tabela enxuta (produto, embalagem, valor, subtotal e total).
- **Proposta de Implantação** — formato Indeba Express, um produto por bloco, com
  custo por litro diluído em destaque.
- **Proposta Comercial** — formato institucional (capa, apresentação da empresa,
  programa de higienização, soluções indicadas e condições comerciais).

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind CSS v4
- **Zod** — contratos de dados (fonte única de validação)
- **Playwright / Chromium** — renderização HTML → PDF
- **Ollama** (Qwen 2.5) — seleção e texto (opcional; com fallback determinístico)
- **Vitest** — testes

## Como rodar

```bash
pnpm install
pnpm exec playwright install chromium   # navegador para o render de PDF
pnpm dev                                 # http://localhost:3000
```

Para gerar o build de produção:

```bash
pnpm build
pnpm start
```

## Configuração

Copie `.env.example` para `.env` e ajuste as variáveis (URL do Ollama, modelo, etc.).
O catálogo de produtos fica em `data/catalogo.json`.

## Estrutura

```
src/
  app/                  UI e rotas de API (App Router)
    api/montar          briefing/entrada → PropostaScope
    api/montar-estruturado
    api/pdf             PropostaScope → PDF
  lib/
    contracts/          schemas Zod (Produto, PropostaScope, Entrada…)
    catalogo.ts         leitura/validação do catálogo
    selecao/            matcher por facetas (linha, segmento, função, método)
    llm/                cliente Ollama, extração de facetas e texto
    pdf/                templates por tipo + render (Playwright)
    tipo-proposta.ts    detecção do tipo de proposta
data/catalogo.json      catálogo de produtos
public/                 imagens dos produtos e identidade visual
docs/                   documentação de apoio
```

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | build e execução de produção |
| `pnpm test` | testes (Vitest) |
| `pnpm lint` | ESLint |
