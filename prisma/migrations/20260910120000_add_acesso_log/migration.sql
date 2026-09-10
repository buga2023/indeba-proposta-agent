-- Registro de acessos (audio do Mateus, 10/09/2026): "por uma questao de protecao de
-- dados... a gente ter o registro de toda vez que voce fizer essas manutencoes de acesso...
-- gerar la na plataforma para mim, como administrador, ver os ultimos acessos".
-- Uma linha por login bem-sucedido e por tentativa recusada. Sem FK para Usuario: a
-- tentativa recusada pode ser de conta inexistente, e o registro sobrevive a remocao da conta.
CREATE TABLE "AcessoLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "resultado" TEXT NOT NULL DEFAULT 'entrou',
    "motivo" TEXT,
    "ip" TEXT,
    "agente" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcessoLog_criadoEm_idx" ON "AcessoLog"("criadoEm");
CREATE INDEX "AcessoLog_email_idx" ON "AcessoLog"("email");
