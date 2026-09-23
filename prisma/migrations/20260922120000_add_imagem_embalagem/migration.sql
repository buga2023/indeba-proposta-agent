-- Foto por embalagem cadastrada pela tela (áudio do Mateus, 22/09/2026): o cadastro só tinha
-- espaço para uma foto, e produtos como o HTC Expolidor têm recipientes diferentes por tamanho.
CREATE TABLE "ImagemEmbalagem" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "imagem" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagemEmbalagem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImagemEmbalagem_codigo_chave_key" ON "ImagemEmbalagem"("codigo", "chave");
