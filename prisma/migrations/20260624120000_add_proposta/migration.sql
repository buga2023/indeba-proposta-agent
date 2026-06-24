-- CreateTable
CREATE TABLE "Proposta" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "autor" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "segmento" TEXT,
    "tipo" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "scope" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proposta_status_idx" ON "Proposta"("status");

-- CreateIndex
CREATE INDEX "Proposta_autor_idx" ON "Proposta"("autor");
