# Estrutura dos modelos de proposta Indeba (aprendido dos PDFs)

## ⚑ São 3 TIPOS de proposta (o sistema detecta pelo prompt)

O vendedor já chega sabendo o que quer; o sistema deve **inferir o tipo pelo prompt** e,
**em dúvida, PERGUNTAR** (melhor perguntar do que errar). Os 3 tipos:

1. **Orçamento (ERP)** — saída crua/simples: tabela qt./produto/valor unitário/subtotal
   (ref.: `GVA_ALIMENTOS_..._Orcamento_9572`). É o documento que já existe hoje.
2. **Proposta de Implantação** — formato Express (ref.: Proposta GVA). Detalhado na "Modelo A".
3. **Proposta Comercial** — formato fabricante (ref.: Proposta Dengo). Detalhado na "Modelo B".

**PERGUNTA EM ABERTO (responder depois):** como os 3 tipos se relacionam? O usuário disse
que são "completamente diferentes mas se baseiam uma na outra" e ainda **não sabe** a relação
exata (orçamento → implantação → comercial? mesma base, saídas diferentes?). Não assumir —
confirmar com ele antes de acoplar a lógica.

---


> Anatomia completa dos dois formatos de proposta, extraída de `docs/evidencia/`.
> Base para o template parametrizado por marca. Fonte: Proposta GVA (Express) e
> Proposta Comercial Dengo / Laticínio Taquipe (fabricante).

## Modelo A — Indeba Express (ref: Proposta GVA · Matheus Resende / IES)

Distribuidor. Formato **enxuto, 1 item por página**. Identidade: faixa navy com onda
laranja/cinza + logo "ies / indeba express".

Ordem das páginas:
1. **Cabeçalho** (só na pág. 1): banner navy full-width + logo ies.
2. **Título** centralizado: "Proposta de implantação".
3. **Bloco cliente**: Cliente / Responsável / Data — cada um em **barra destacada creme**.
4. **Itens (1 por página)**:
   - `N. Item: <Nome> – <DESCRIÇÃO EM MAIÚSCULAS completa> – UTILIZAR NO DILUIDOR AUTOMÁTICO` (negrito azul).
   - **Foto grande** centralizada do produto.
   - Bullets `o` em **barras creme**:
     - `Valor embalagem de <tam> R$: <preço>`
     - `Valor por litro diluído (Diluição de até <dil>) R$: <custo> centavos`
     - `Observações: Para mais informações solicitar ficha técnica, diluição máxima; na prática pode variar de 1:10, 1:20, 1:50 a depender da sujidade.`
   - **Rodapé** com endereço Boca do Rio + telefone (em **toda página**).
5. **Fechamento** (após o último item):
   - **Diluidores Seko Pro Max** — imagem do diluidor de químicos Promax Seko.
   - **Painel de fichas técnicas e informações de EPI** — painel Indeba Express com ícones.
   - Assinatura: "Atenciosamente, Matheus Resende — 71 99196-2650" + endereço.

Condições comerciais: a proposta Express **não traz tabela formal**; os termos vêm do
orçamento do ERP (validade=data, previsão de entrega 72h, faturamento boleto 28 dias,
contrato de comodato 12 meses).

## Modelo B — Proposta Comercial / Indeba fabricante (ref: Dengo / Laticínio Taquipe)

Fabricante (desde 1966). Formato **rico/editorial**, 8 páginas. Identidade: logo Indeba
(frasco) + "Química e Soluções em Higiene". Cabeçalho de página = só o logo no canto sup. dir.
(a partir da pág. 2). Tudo abaixo é **observado nas páginas**, nada inventado:

1. **Capa dedicada** (p1): logo Indeba grande centralizado + título "Proposta Comercial" +
   CLIENTE (ex.: "LATICÍNIO TAQUIPE") + MÊS/ANO no rodapé.
2. **Institucional** (p2): "A Indeba é uma Indústria Química que vai além da Higienização" +
   parágrafos (desde 1966, +200 produtos ANVISA, Sistema Indeba). **"Linhas de atuação:"** com
   os **7 ícones** (lavanderia, alimentos e bebidas, limpeza e conservação, higiene clínica,
   higiene pessoal, tratamento de pisos, automotiva). **Mapa do Brasil** "INDEBA DISTRIBUIDORES"
   (legenda: fábrica / distribuição / centros de distribuição / unidade própria) + "SEJA NOSSO
   PARCEIRO!".
3. **Programa "Experiência Segura"** (p3): "A Indeba pode ajudá-lo a fazer diferença" + diagrama
   radial com **8 pilares** — produtos de alta performance, selo para chancelar a higienização,
   material ilustrativo (cartazes/adesivos), equipamentos, validações da higienização, sugestões
   de procedimentos operacionais, capacitação (Procedimentos de Limpeza / Uso dos Produtos
   Químicos / Segurança dos Alimentos), assistência técnica (visitas periódicas).
4. **"As 5 Etapas Essenciais de Higienização"** (p4–p5): metodologia em etapas numeradas
   (Etapa 1…5), incluindo Assistência Técnica (visitas com efeito corretivo/preventivo, escala
   de atendimento mensal/semanal) e Etapa 5 — Materiais de Comunicação.
5. **"Soluções Indicadas para o [Cliente]"** (p5–p8): produtos **específicos pro cliente**.
   Cada produto: bullet negrito `NOME – descrição curta` + parágrafo de uso; **foto à esquerda**;
   três caixas centralizadas: **Embalagem** | **Preço** | **Custo final por kg/litro diluído até
   1:NN**. **Multi-embalagem é comum** (ex.: PRIMMAX CIP DT em 7,5kg=R$113,17 e 75kg=R$949,20;
   CIP NITRO 6,6kg e 66kg; SANAP 5kg e 20kg).
6. **Condições Comerciais** (p8, **tabela**): Validade desta proposta (data) · Prazo de entrega
   (ex.: "Salvador e região metropolitana — até 5 dias úteis") · Condições de pagamento (ex.:
   "À negociar") · Frete (CIF) · **Pedido mínimo frete CIF** (ex.: R$ 1.200,00).
7. **Observações** (p8): "Assistência técnica e manutenção dos equipamentos Indeba são
   permanentes" · "Produtos ofertados são de fabricação da Indeba Indústria e Comércio Ltda,
   origem nacional e marca Indeba".

Diferença-chave vs Implantação: Comercial = **institucional + metodologia (5 etapas) +
Experiência Segura + condições em tabela com pedido mínimo**; produtos em caixas (não tabela
linha-a-linha) e multi-embalagem. Implantação (Express) = direto ao produto, 1 por página,
sem institucional.

## Insights que governam o produto

- **Identidade parametrizada por marca** (Express × fabricante) — já no `template.ts` (`MARCAS`).
- **1 produto → N embalagens** com preço/custo próprios: o MESMO produto aparece nos dois
  formatos com embalagem diferente (DGCLOR 5L = R$ 110,00 no Express vs 23kg = R$ 318,78 no
  fabricante; custo 0,22 vs 0,14). O contrato (`Embalagem[]`) já suporta.
- **Custo é sempre atrelado à diluição** ("custo por litro diluído até 1:NN") — é o pitch de venda.
- **Observação padrão por item** (solicitar ficha técnica; diluição varia com a sujidade).
- **Fechamento Express** tem elementos de marca fixos: **diluidor Seko Pro Max** + **painel de
  fichas técnicas/EPI**.
- **"Experiência Segura"** (8 pilares) é o diferencial institucional do formato fabricante.
