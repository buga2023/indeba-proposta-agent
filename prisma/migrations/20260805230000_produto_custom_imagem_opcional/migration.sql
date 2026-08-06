-- Foto própria vira OPCIONAL na tabela de produtos cadastrados pela tela.
--
-- Até aqui, toda linha desta tabela era um produto novo, e produto novo sem foto não entra
-- no catálogo — daí o NOT NULL. Agora a mesma tabela guarda também os OVERRIDES dos ~150
-- produtos da base (data/catalogo.json): o gestor edita o preço ou a descrição de um deles e
-- o ajuste é gravado aqui. Nesse caso a foto continua sendo a que já está versionada em
-- public/produtos/, e exigir reenviá-la só para corrigir um texto seria trabalho inventado.
--
-- Sem bytes gravados, `imagemPath` volta a apontar para o arquivo do JSON (produto-custom.ts).
ALTER TABLE "ProdutoCustom" ALTER COLUMN "imagem" DROP NOT NULL;
ALTER TABLE "ProdutoCustom" ALTER COLUMN "imagemMime" DROP NOT NULL;
