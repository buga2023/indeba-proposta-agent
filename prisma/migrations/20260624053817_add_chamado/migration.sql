-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "prioridade" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "autor" TEXT NOT NULL,
    "respostaGestor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chamado_status_idx" ON "Chamado"("status");

-- CreateIndex
CREATE INDEX "Chamado_autor_idx" ON "Chamado"("autor");
