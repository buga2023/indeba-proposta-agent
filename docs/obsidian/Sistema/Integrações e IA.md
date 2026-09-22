# Integrações e IA

- **Ollama** roda no PC do Gustavo e é exposto por túnel cloudflared; a Vercel chama pela `OLLAMA_BASE_URL` (URL efêmera). Frágil: IA em produção só funciona com PC, Ollama e túnel ligados. Endgame: VPS.
- **Qdrant Cloud**: base vetorial do atendimento (RAG). Índice via `npm run rag:index`.
- **Tavily**: busca web para prospecção. **Receita Federal**: base no Postgres (EmpresaReceita).
- **SMTP** (nodemailer): disparo de cobrança e avisos ao gestor.
- **Pollinations**: imagens dos posts de Instagram.
- **Upstash Redis**: rate limit em produção.

Variáveis em `.env.example`. Runbook completo em `docs/prod-setup.md`.

Os agentes de IA (prospecção, Instagram, financeiro, cobrança, compras, fiscal, contábil, contrato, atendimento) existem no código mas foram tirados do menu em 25/08 a pedido do Mateus. O produto vendido às distribuidoras é o núcleo determinístico: propostas, catálogo e ferramentas ([[Planos e regras]]).
