# CLAUDE.md — IGREJAQUA

Plataforma SaaS multi-tenant de gestão de igrejas. **Estado atual: Gates 1–6 implementados (ver `docs/GATES/GATE_PROGRESS.md`); Gate 4 em andamento.** Leia `docs/ARCHITECTURE.md` antes de qualquer mudança. Comunique-se em português (Brasil).

## Preferências do responsável (obrigatórias)
- **Idioma:** toda comunicação com o responsável é em português (Brasil), sempre — respostas, resumos, perguntas e relatórios. Nunca responder em inglês.
- **Git:** commits e push vão **direto para a `main`** (autorização permanente do responsável). Antes do push: `npm run check` e `npm run build` verdes; `git fetch` e push somente se for avanço direto (fast-forward). Nunca usar force-push nem reescrever o histórico da `main`; em divergência, integrar com merge e avisar.

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
Direção "Noite & Âmbar" (`docs/UX_DESIGN.md`, decisão do responsável): tema escuro azul-noite, âmbar como cor de marca, cartões arredondados, botões em pílula, navegação inferior no mobile. Use apenas os tokens de `globals.css` (`fundo`, `superficie`, `texto`, `ambar`, `sucesso`, `perigo`…). Proibido: neon, emoji como ícone, fotos/números/eventos fictícios, gráficos de exemplo.
