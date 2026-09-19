-- CNPJ no contrato de comodato (áudio do Mateus com o João, 19/09/2026): a busca de
-- contrato é por "cliente ou CNPJ". Nullable porque os contratos já cadastrados não
-- têm o número, e um NOT NULL exigiria backfill inventado.
ALTER TABLE "ContratoComodato" ADD COLUMN "cnpj" TEXT;
