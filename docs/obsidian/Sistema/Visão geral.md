# Visão geral

**Indeba Express** (repo `indeba-proposta-agent`) é a plataforma comercial e técnica da distribuidora. Começou como gerador de propostas por IA e virou o sistema do dia a dia: propostas, catálogo, ferramentas comerciais e técnicas, contratos.

Produção: https://indeba-express.vercel.app · Repositório: github.com/buga2023/indeba-proposta-agent

## Regra de procedência
Preço, ficha técnica, embalagem e imagem vêm **sempre do catálogo**. A IA escolhe e escreve, nunca inventa valor. Cada item carrega de onde veio (CATÁLOGO, IA-SELEÇÃO, IA-TEXTO, MANUAL).

## Stack
| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24, pnpm |
| Framework | Next.js 16 App Router (UI + API no mesmo app) |
| UI | React 19, estilos inline + globals.css |
| Tipos | TypeScript strict, Zod como fonte única (src/lib/contracts) |
| Banco | PostgreSQL (Supabase em prod) + Prisma |
| PDF | Playwright/Chromium serverless (@sparticuz/chromium) renderizando HTML |
| Vetorial | Qdrant Cloud (RAG do atendimento) |
| IA | Ollama via túnel cloudflared (ver [[Integrações e IA]]) |
| Hospedagem | Vercel, deploy pelo push na main (ver [[Deploy e produção]]) |

## Mapa do código
- `src/app/page.tsx` · shell da aplicação: sidebar, pilha de telas, ScreenHead, telas principais (arquivo grande, ~6.500 linhas)
- `src/components/` · telas em componentes próprios: ferramentas comerciais e técnicas, chamados, admin, cadastro de produto, chat de edição
- `src/app/api/` · rotas (ver [[API]])
- `src/lib/` · contratos Zod, PDF, catálogo, autenticação, ferramentas
- `prisma/schema.prisma` · modelo de dados (ver [[Modelo de dados]])
- `public/marca` · logos Indeba Express · `public/gerador-contratos` · gerador estático
- `apresentacao/` · deck, vídeo, prints, planos (ver [[Material de apresentação]])
- `tests/` · unit (vitest), e2e (playwright) · `.claude/skills/` · deploy e transcrever-audio
