-- CreateTable
CREATE TABLE "ContatoCliente" (
    "cliente" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContatoCliente_pkey" PRIMARY KEY ("cliente")
);

-- CreateTable
CREATE TABLE "Config" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("chave")
);
