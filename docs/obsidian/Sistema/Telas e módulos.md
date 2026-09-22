# Telas e módulos

Navegação é por estado (`screen` em page.tsx), não por rota. A sidebar tem os grupos **Visão geral**, **Criar proposta**, **Módulos** e **Sistema** (só admin).

| Tela | Chave | Onde vive | O que faz |
|---|---|---|---|
| Dashboard | dashboard | page.tsx | Números do mês, cards dos módulos, atividade recente |
| Proposta de Solução | manual | page.tsx ManualScreen | Montagem: cliente, condições comerciais, produtos do catálogo. Fica sempre montada (display none) para não perder rascunho |
| Revisão / PDF | review, pdf | page.tsx | Cards dos produtos, total, Gerar PDF |
| Propostas Feitas | history | page.tsx HistoryScreen | Histórico com consultor, status, valor; busca por cliente ou CNPJ; aba Excluídas |
| Catálogo de Produtos | catalog | page.tsx CatalogScreen | Linhas, funções, marcas, ficha em PDF; cadastro (admin) |
| Ferramentas Comerciais | ferramentas-comerciais | components/ferramentas-comerciais-screen.tsx | Registro de Prospecções, Visitas de Rotina (comercial), Solicitações Comerciais |
| Ferramentas Técnicas | ferramentas | components/ferramentas-tecnicas-screen.tsx | Visitas de Rotina (técnica, com status), Contratos e Comodatos, Estoque de Comodatos |
| Gerador de Contratos | gerador-contratos | iframe de /gerador-contratos/index.html | Ver [[Gerador de Contratos]] |
| Chamados | chamados | components/chamados-screen.tsx | Suporte interno |
| Configurações | config | components/admin-screen.tsx | Liberação de acessos, time, e-mails |
| Meu perfil | perfil | page.tsx | Dados do usuário |

Telas que existem no código mas **sem porta no menu** (decisão do Mateus 25/08): prospecção por IA, Instagram, financeiro, cobrança, compras, fiscal, contábil, contrato por IA, atendimento RAG, importar orçamento.

## Navegação
- **Voltar**: pilha de telas em page.tsx (`pilhaTelas`); botão em todo cabeçalho, some no Dashboard. Adicionado em 22/09 ([[Diário 2026-09-22]]).
- **BarraTopo**: telas de componentes (Ferramentas, Chamados, Configurações, Gerador) não usam ScreenHead; ganharam barra com menu + Voltar.
- **Celular** (≤760px): sidebar vira gaveta; hambúrguer no cabeçalho. KPIs do Dashboard em 2 colunas.
- **Ctrl+K**: paleta de busca de telas e produtos.

## Regras de negócio que já foram pedidas
- Visita de rotina: status resolvido/não resolvido **só na técnica**. Na comercial nem aparece e o PDF não pode mostrar (21/09).
- Todo mundo vê os registros; **só o dono edita**; só o gestor exclui e restaura (16/09, 25/08).
- Quem assina a proposta é o dono dela, não quem está logado (16/09).
- Filtro por cliente e período nas listas de ferramentas; listas recolhidas por padrão (19/09).
- CNPJ no contrato e busca por cliente ou CNPJ (19/09).
