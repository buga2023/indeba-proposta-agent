-- Produto cadastrado pela tela (Catálogo → Novo produto), do gestor.
--
-- Os 150 da base INDEBA/PRATT seguem em data/catalogo.json: a função da Vercel é
-- somente-leitura e não há como gravar naquele arquivo em produção. Esta tabela é a segunda
-- fonte, e `catalogoCompleto()` une as duas — ver docs/spec-cadastro-produto.md.
--
-- Foto e ficha ficam como bytes na própria linha em vez de um serviço de storage: para
-- dezenas de produtos é suficiente e não exige provisionar nada novo.
CREATE TABLE "ProdutoCustom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "imagem" BYTEA NOT NULL,
    "imagemMime" TEXT NOT NULL,
    "ficha" BYTEA,
    "fichaMime" TEXT,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoCustom_pkey" PRIMARY KEY ("id")
);

-- O código é a chave de negócio do catálogo: é por ele que proposta, matcher e RAG
-- referenciam o produto. Duplicar código faria duas fontes disputarem o mesmo item.
CREATE UNIQUE INDEX "ProdutoCustom_codigo_key" ON "ProdutoCustom"("codigo");
