# Modelo de dados (Prisma)

Arquivo: `prisma/schema.prisma`. Banco: Postgres (Supabase em produção, pooler na porta 6543; local via docker-compose).

| Modelo | Para quê |
|---|---|
| Usuario | login, papel (admin/vendedor), liberação pelo gestor |
| AcessoLog | trilha de acessos |
| Proposta | proposta salva com scope canônico, status, dono |
| ProdutoCustom | produtos cadastrados ou sobrescritos pelo gestor (a base vem de data/ e public/) |
| Config | ajustes do gestor (e-mails, textos padrão) |
| ContatoCliente | e-mails de clientes |
| VisitaCarteira, VisitaFoto | visitas de rotina; campo `area` = comercial ou tecnica; `status` só faz sentido na técnica |
| RelatorioProspeccao | registro de prospecções |
| SolicitacaoComercial | pedidos do vendedor ao técnico, com status |
| ContratoComodato | contrato/comodato com PDF anexado e CNPJ |
| EstoqueComodato | equipamentos cedidos por cliente |
| Anexo | fotos e documentos das ferramentas |
| Chamado | suporte interno |
| EmpresaReceita | base da Receita Federal para prospecção |

Contratos Zod em `src/lib/contracts/` espelham esses modelos e são a fonte única de tipos para UI e API.
