-- Aba Excluídos (áudio do Mateus, 25/08/2026): excluir vira lápide (`excluidoEm`);
-- restaurar limpa a coluna, excluir definitivo apaga a linha.
ALTER TABLE "VisitaCarteira" ADD COLUMN "excluidoEm" TIMESTAMP(3);
ALTER TABLE "RelatorioProspeccao" ADD COLUMN "excluidoEm" TIMESTAMP(3);
ALTER TABLE "SolicitacaoComercial" ADD COLUMN "excluidoEm" TIMESTAMP(3);
ALTER TABLE "ContratoComodato" ADD COLUMN "excluidoEm" TIMESTAMP(3);
ALTER TABLE "EstoqueComodato" ADD COLUMN "excluidoEm" TIMESTAMP(3);
