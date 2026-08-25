-- Ferramentas Técnicas (áudio do Mateus, 21/08/2026): três tabelas novas, todas com o
-- recorte por `autor` — vendedor vê só os próprios registros, gestor vê todos.

-- Registro de Visitas da Carteira: data, horário, cliente, quem recebeu, telefone,
-- status (resolvido/não resolvido) e observação.
CREATE TABLE "VisitaCarteira" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "quemRecebeu" TEXT NOT NULL,
    "telefone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nao_resolvido',
    "observacao" TEXT,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitaCarteira_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitaCarteira_autor_idx" ON "VisitaCarteira"("autor");

-- Contratos e Comodatos: cliente, comodatos (texto livre), observações e a cópia do
-- contrato em PDF como bytes na linha (mesmo padrão da ficha de ProdutoCustom).
CREATE TABLE "ContratoComodato" (
    "id" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "comodatos" TEXT NOT NULL,
    "observacoes" TEXT,
    "contrato" BYTEA,
    "contratoMime" TEXT,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratoComodato_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContratoComodato_autor_idx" ON "ContratoComodato"("autor");

-- Estoque de Comodatos: código, peça, quantidade e observação. Exportável para Excel.
CREATE TABLE "EstoqueComodato" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "peca" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "obs" TEXT,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueComodato_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EstoqueComodato_autor_idx" ON "EstoqueComodato"("autor");
