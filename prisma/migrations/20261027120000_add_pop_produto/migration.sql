-- Gerador POP (guia de uso dos produtos de limpeza): catálogo de produtos compartilhado entre
-- os usuários. Antes o HTML guardava tudo no navegador de cada um.
CREATE TABLE "PopProduto" (
    "id" TEXT NOT NULL,
    "ordem" DOUBLE PRECISION NOT NULL,
    "dados" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopProduto_pkey" PRIMARY KEY ("id")
);
