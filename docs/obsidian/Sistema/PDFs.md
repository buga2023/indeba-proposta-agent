# PDFs

Todos renderizados de HTML com Chromium serverless (`src/lib/pdf/render.ts`). Logo sempre **Indeba Express** (`public/marca`), não a institucional Indeba (corrigido em 19/09).

| Documento | Rota | Template |
|---|---|---|
| Proposta de Solução (1 página rica por produto) | api/pdf | src/lib/pdf/template-consolidada.ts, capa-express.ts |
| Orçamento / Comercial (modelos antigos) | api/pdf | template-orcamento.ts, template-comercial.ts |
| Ficha de visita, prospecção, solicitação | api/registros/[tipo]/[id]/pdf | src/lib/pdf/registro.ts (selo resolvido/não resolvido só quando area = tecnica) |
| Contrato/comodato | api/comodatos/[id]/pdf | registro.ts |
| Contrato de fornecimento (gerador) | no navegador, pdf-lib | public/gerador-contratos/index.html |

Ver também [[Gerador de Contratos]]. Anatomia dos modelos históricos em `docs/estrutura-modelos.md`.
