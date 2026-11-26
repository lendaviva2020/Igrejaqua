# CLAUDE.md — IGREJAQUA

Plataforma SaaS multi-tenant de gestão de igrejas. **Estado atual: Gates 1–6 implementados (ver `docs/GATES/GATE_PROGRESS.md`); Gate 4 em andamento.** Leia `docs/ARCHITECTURE.md` antes de qualquer mudança. Comunique-se em português (Brasil).

## Regras inegociáveis
- Nunca gerar código quebrado; sem `any`, sem `// TODO`, sem placeholders, sem dados fictícios em produção.
- Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`) só no servidor; `lib/supabase/admin.ts` tem `import 'server-only'`.
- Todo dado de igreja tem `church_id`; FKs compostas `(church_id,id)`; RLS habilitada (não FORCE: helpers SECURITY DEFINER em `private`). `church_id` nunca vem do cliente.
- Autorizar com `supabase.auth.getUser()`, nunca `getSession()`.
- IA é consultiva: `coleta → geração → validação determinística → revisão humana → rascunho → publicação`. Nunca publica sozinha.
- Não declarar algo concluído sem evidência (saída de `tsc`, `lint`, `build`, testes, pgTAP).
- Mudanças de schema só por migration nova e testada (`supabase/tests`). Não sobrescrever nem apagar trabalho existente sem autorização.

## Comandos (npm)
`npm run typecheck` · `npm run lint` · `npm run build` · `npm test` · `npm run test:e2e` · `npm run test:sql` · `npm run check`

## Onde está cada coisa
Arquitetura `docs/ARCHITECTURE.md` · Banco `docs/DATABASE.md` · RBAC `docs/RBAC.md` · Segurança `docs/SECURITY.md` · Regras `docs/DOMAIN_RULES.md` · IA `docs/AI_ENGINE.md` · UX `docs/UX_DESIGN.md` · Gates `docs/IMPLEMENTATION_ROADMAP.md` · ADRs `docs/ADR/`.

## Skills do projeto (`.claude/skills/`)
`vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions`, `web-design-guidelines`, `frontend-design`, `skill-creator`. Use `frontend-design` ao criar UI e `web-design-guidelines` + `vercel-react-best-practices` ao revisá-la.

## Design
Direção "Caderno de Culto" (`docs/UX_DESIGN.md`): papel quente, filete duplo, serifa + grotesca humanista, acento único cobre. Proibido gradiente exagerado, neon, brilho, glassmorphism, emoji como ícone, cards repetitivos, gráficos fictícios.
