-- Ferramentas Comerciais (foto do bloco do Mateus, 21/08/2026): a lista tem DUAS partes
-- espelhadas — comerciais e técnicas — e ambas começam com o Relatório de Visitas de
-- Rotina. A visita ganha `area` para servir às duas telas com uma tabela só.
ALTER TABLE "VisitaCarteira" ADD COLUMN "area" TEXT NOT NULL DEFAULT 'tecnica';

-- Relatório de Novas Prospecções: anotação manual do vendedor (não confundir com o
-- módulo Prospecção por IA).
CREATE TABLE "RelatorioProspeccao" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "contato" TEXT,
    "telefone" TEXT,
    "observacao" TEXT,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioProspeccao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RelatorioProspeccao_autor_idx" ON "RelatorioProspeccao"("autor");

-- Solicitações Comerciais: análise de água e/ou tecidos, visita do setor técnico, ou
-- amostra para demonstrações; status pendente → atendida.
CREATE TABLE "SolicitacaoComercial" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoComercial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitacaoComercial_autor_idx" ON "SolicitacaoComercial"("autor");
