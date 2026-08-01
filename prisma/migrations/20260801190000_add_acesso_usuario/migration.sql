-- Portão de entrada por aprovação do gestor.
--
-- O cadastro em /cadastro é aberto (o colaborador cria a própria conta), e até aqui quem se
-- cadastrava entrava direto. `acesso` separa ENTRAR de PODER: `papel` continua dizendo o que
-- a pessoa faz depois de entrar; `acesso` diz se ela entra.
--
-- A coluna nasce com default 'pendente' — é isso que vale para todo cadastro NOVO. Mas quem
-- já está no banco está usando o sistema hoje: subir com todos pendentes trancaria o time
-- inteiro (o gestor inclusive) do lado de fora no primeiro deploy. Por isso o UPDATE logo
-- abaixo aprova o que já existe. A ordem importa: ADD COLUMN primeiro, UPDATE depois.
ALTER TABLE "Usuario" ADD COLUMN "acesso" TEXT NOT NULL DEFAULT 'pendente';

UPDATE "Usuario" SET "acesso" = 'aprovado';

CREATE INDEX "Usuario_acesso_idx" ON "Usuario"("acesso");
