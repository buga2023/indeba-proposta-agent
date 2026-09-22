# Autenticação e segurança

- **Login** próprio (e-mail + senha), sessão em cookie `sessao`, segredo em `AUTH_SESSION_SECRET`. `AUTH_ENABLED=false` desliga só para desenvolvimento local.
- **Cadastro** de colaborador entra numa fila; o gestor libera em Configurações antes do primeiro acesso.
- **Papéis**: admin (gestor) e vendedor. Rotas de gestão respondem 403; a sidebar esconde o grupo Sistema para vendedor.
- **Middleware** (`src/middleware.ts`): protege `/`, `/api/*` e, desde 22/09, `/gerador-contratos` e `/gerador-contratos/*`. Rate limit por IP com baldes separados para login e API.
- **Cabeçalhos** (next.config.ts): CSP só em produção, X-Frame-Options DENY, HSTS, nosniff. Exceção: em `/gerador-contratos/*` o frame é liberado para a própria origem (SAMEORIGIN, frame-ancestors 'self') porque a tela é um iframe de mesma origem.
- **Testes de produção** (`tests/e2e/producao-smoke.spec.ts`): app no ar, APIs fechadas para anônimo.
