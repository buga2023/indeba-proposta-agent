-- Status comercial: default de criação passa de 'rascunho' para 'em_andamento'
-- (ago/2026 — só quatro status escolhíveis; 'rascunho' virou legado de leitura).
ALTER TABLE "Proposta" ALTER COLUMN "status" SET DEFAULT 'em_andamento';
