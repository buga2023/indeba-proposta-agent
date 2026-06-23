-- CreateTable
CREATE TABLE "EmpresaReceita" (
    "cnpj" VARCHAR(14) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnaePrincipal" VARCHAR(7) NOT NULL,
    "situacao" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "municipioNome" TEXT,
    "municipioCod" VARCHAR(7),
    "bairro" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "cep" VARCHAR(8),
    "telefone1" TEXT,
    "telefone2" TEXT,
    "email" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaReceita_pkey" PRIMARY KEY ("cnpj")
);

-- CreateIndex
CREATE INDEX "EmpresaReceita_cnaePrincipal_uf_idx" ON "EmpresaReceita"("cnaePrincipal", "uf");

-- CreateIndex
CREATE INDEX "EmpresaReceita_uf_municipioNome_idx" ON "EmpresaReceita"("uf", "municipioNome");

-- CreateIndex
CREATE INDEX "EmpresaReceita_situacao_idx" ON "EmpresaReceita"("situacao");
