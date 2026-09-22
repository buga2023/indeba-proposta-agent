# Gerador de Contratos

Pacote entregue em 21/09/2026 (zip `indeba-gerador-contratos-pacote-dev`) e integrado em 22/09.

- **O que é**: página estática (HTML + JS) que monta o Contrato de Fornecimento de Produtos Químicos e Prestação de Serviços de Assistência Técnica, com comodato, e gera o PDF no navegador com pdf-lib (6 páginas A4, logo Indeba Express). Sem back-end; nada sai do navegador.
- **Onde**: `public/gerador-contratos/index.html` (+ pdf-lib.min.js local, docs/).
- **No sistema**: tela `gerador-contratos` (iframe de mesma origem), item no menu Módulos, card no Dashboard, entrada na busca Ctrl+K.
- **Proteção**: middleware exige login; cabeçalhos liberam frame só para a própria origem.
- **Campos**: razão social, CNPJ (máscara e validação), valor (por extenso automático), equipamentos, duração, data de assinatura, cláusula 14.2 editável. Guarda os campos em localStorage do computador.
- **Manutenção**: cláusulas na constante CLAUSES do index.html; texto vigente em `public/gerador-contratos/docs/clausulas-atuais.md`.

## Pendências (do próprio pacote)
- Decidir quem pode editar a cláusula 14.2 (hoje qualquer usuário).
- Escolher a plataforma de assinatura digital e testar o PDF nela.
- Revisão jurídica do texto. Lista completa em `public/gerador-contratos/docs/PENDENCIAS.md`.
- Evolução sugerida: rota de servidor que gera e registra contratos por cliente.
