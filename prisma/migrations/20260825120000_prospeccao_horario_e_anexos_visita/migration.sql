-- Áudios do Mateus, 25/08/2026.

-- Registro de Prospecções ganha horário além da data (nulo nos registros antigos).
ALTER TABLE "RelatorioProspeccao" ADD COLUMN "horario" TEXT;

-- Visitas de rotina (técnicas e comerciais) ganham anexos: um documento na própria linha
-- (a assinatura que o João colhe) e até 10 fotos em tabela própria — uma foto por linha,
-- subida uma por requisição para caber no teto de ~4,5 MB da função da Vercel.
ALTER TABLE "VisitaCarteira" ADD COLUMN "documento" BYTEA;
ALTER TABLE "VisitaCarteira" ADD COLUMN "documentoMime" TEXT;
ALTER TABLE "VisitaCarteira" ADD COLUMN "documentoNome" TEXT;

CREATE TABLE "VisitaFoto" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "foto" BYTEA NOT NULL,
    "fotoMime" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaFoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitaFoto_visitaId_idx" ON "VisitaFoto"("visitaId");

ALTER TABLE "VisitaFoto" ADD CONSTRAINT "VisitaFoto_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "VisitaCarteira"("id") ON DELETE CASCADE ON UPDATE CASCADE;
