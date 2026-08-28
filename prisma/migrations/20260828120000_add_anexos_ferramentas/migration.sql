-- Anexos das ferramentas (audio do Mateus, 27/08/2026): fotos e documentos em qualquer
-- registro de prospeccao, solicitacao, contrato/comodato ou estoque.
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL,
    "registroTipo" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nome" TEXT,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Anexo_registroTipo_registroId_idx" ON "Anexo"("registroTipo", "registroId");
