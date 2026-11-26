# IGREJAQUA — Arquitetura

Status: **PENDING_REVIEW** (Gate 0, aguardando aprovação humana)

## 1. Escopo e reconciliação dos dois prompts

Dois documentos de requisitos foram fornecidos e **não são idênticos**:

| Fonte | Foco |
|---|---|
| Prompt "Gate 0 — Master Architecture" | Louvor/equipes, repertório ChordPro, Stage Mode, IA DeepSeek, escalas, oração, PIX |
| Prompt "Master Engineering & Design" | Gestão geral: famílias, visitantes, células, financeiro (dízimos/ofertas), relatórios, multi-igreja |

**Decisão proposta (PENDING_REVIEW):** o produto é a união, entregue em duas ondas.

- **Onda 1 (piloto, Gates 2–5):** identidade, igrejas, membros, ministérios, eventos/sessões, escalas, repertório, Stage Mode, IA, comunicados/devocionais, oração, presença, PIX informativo.
- **Onda 2 (pós-piloto):** famílias/relacionamentos, visitantes, células, relatórios avançados e **ledger financeiro** (dízimos/ofertas). O ledger é dado financeiro sensível e exige revisão LGPD própria; na Onda 1 só existe informação PIX (sem registrar valores de membros).

O modelo de dados da Onda 1 já reserva o lugar dessas entidades (ver `DATABASE.md` §9) sem criá-las.

## 2. Estilo: monólito modular

Um único deploy Next.js; módulos com fronteiras explícitas em `src/modules/*`. Ver ADR-0001.

```
Browser (PWA) ─▶ Next.js App Router (Vercel)
                  ├─ Server Components  (leitura, SSR)
                  ├─ Server Actions     (mutações de formulário)
                  ├─ Route Handlers     (/api/ai, /api/webhooks, SSE/export)
                  └─ modules/*          (regras de negócio, sem React)
                          │
                          ▼
              Supabase (Postgres + RLS, Auth, Storage)
                          │
                          ▼ (somente servidor)
                    DeepSeek API
```

### Regras de dependência entre camadas

```
app/ (rotas) ─▶ modules/<x>/{actions,queries}  ─▶ modules/<x>/domain
components/ ─▶ (só tipos/DTOs, nunca supabase)     lib/{supabase,permissions,security,validations}
```

1. `domain/` é TypeScript puro (sem Next, sem Supabase) → testável em Vitest sem mocks pesados.
2. Apenas `modules/*/repository.ts` fala com Supabase.
3. Um módulo importa outro **somente** via `modules/<x>/index.ts` (API pública). Lint (`eslint-plugin-boundaries`) falha o build se violado.
4. `components/` nunca importa `lib/supabase/*`.

### Mapa de dependência dos módulos

```
identity ◀── churches ◀── members ◀── ministries ◀── schedules ──▶ events
                │            │             │              │            │
                │            │             └──▶ repertoire ◀──────────┤
                │            │                      │                  │
                │            └──▶ community         └──▶ stage ◀───────┘
                └──▶ notifications ◀── (todos emitem eventos de domínio)
                lib/ai ──▶ schedules, repertoire (somente leitura + proposta)
```

Setas = "depende de". Sem ciclos; `notifications` é folha (consome eventos), `identity` é raiz.

## 3. Estrutura de diretórios (Gate 0 → alvo)

A árvore fornecida pelo usuário é preservada. Acréscimos propostos estão marcados com `+`.

```
IGREJAQUA/
├── public/{icons,images,manifest.json}  (+ sw.js gerado no build)
├── docs/ ARCHITECTURE.md DATABASE.md ER_DIAGRAM.md SECURITY.md RBAC.md
│         DOMAIN_RULES.md AI_ENGINE.md API_CONTRACTS.md UX_DESIGN.md
│         TEST_STRATEGY.md IMPLEMENTATION_ROADMAP.md ADR/ GATES/
├── supabase/{migrations,seed.sql,config.toml,tests}
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx
│   │   ├── (auth)/{login,cadastro,recuperar-senha,callback}
│   │   ├── (app)/{layout.tsx,dashboard,membros,ministerios,agenda,escalas,
│   │   │          repertorio,palco,disponibilidade,comunidade,notificacoes,configuracoes}
│   │   │   + selecionar-igreja/   (escolha do contexto quando o usuário tem >1 igreja)
│   │   ├── api/{ai,webhooks}
│   │   ├── layout.tsx  globals.css
│   ├── components/{ui,layout,dashboard,music,schedule,shared}
│   │   + stage/                     (UI isolada do Stage Mode)
│   ├── modules/{identity,churches,members,ministries,events,schedules,
│   │            repertoire,stage,community,notifications}
│   │     cada módulo: domain/ schemas.ts actions.ts queries.ts repository.ts index.ts
│   ├── lib/{supabase,auth,permissions,validations,chords,music-theory,ai,security,utils}
│   ├── hooks/ types/ config/
│   └── middleware.ts (+)            (refresh de sessão SSR; sem lógica de negócio)
├── tests/{unit,integration,e2e,security}
├── AGENTS.md CLAUDE.md package.json tsconfig.json .env.example
```

## 4. Resolução do contexto de igreja (tenant)

Detalhe e justificativa em ADR-0003. Resumo:

1. Sessão Supabase identifica o **usuário** (`auth.getUser()` no servidor — nunca `getSession()` para autorização).
2. A **igreja ativa** vem de um cookie `iq_church` (httpOnly, Secure, SameSite=Lax) contendo apenas o `church_id`. **O cookie é uma preferência, não uma credencial.**
3. A cada requisição, `lib/auth/context.ts#resolveChurchContext()` consulta `church_memberships` (via cliente com RLS) e só aceita se existir vínculo `active` do usuário com aquela igreja. Retorna `{ userId, churchId, membershipId, role, ministryPermissions }` ou falha com `ForbiddenError`.
4. Cada mutação recebe o contexto resolvido; nenhum `church_id` vindo do cliente é confiável. O `church_id` é **injetado** pelo servidor.
5. No banco, RLS reavalia o vínculo por `auth.uid()` + `church_id` da linha. Ou seja: mesmo que o passo 3 tenha bug, o Postgres bloqueia.

Alternativa registrada: slug na URL (`/{igreja}/dashboard`). Melhor para múltiplas abas, mas altera a árvore de rotas definida. **Recomendação: manter cookie no piloto; migrar para slug se surgir uso multi-igreja simultâneo** (decisão PENDING_REVIEW).

## 5. Fluxo de dados

- **Leitura:** Server Component → `queries.ts` → cliente Supabase SSR (JWT do usuário) → RLS.
- **Escrita:** Server Action → `schemas.ts` (Zod, `.strict()`) → autorização (`lib/permissions`) → `repository.ts` → RLS + triggers de auditoria.
- **Service role:** apenas em `lib/supabase/admin.ts` (`import 'server-only'`), com lista fechada de usos (aceite de convite, job de retenção LGPD, escrita em `ai_generation_runs`). Qualquer outro uso é rejeitado em code review e por teste de lint que proíbe o import fora de `modules/*/admin-*.ts`.

## 6. PWA

Manifest + service worker próprio em `public/sw.js` (sem dependência; Serwist descartado para evitar acoplamento com a versão do Next). Cache **apenas** de: shell estático, fontes, e payload de Stage Mode de eventos publicados que o usuário abriu. Nunca cachear respostas autenticadas genéricas; logout limpa caches. Ver `SECURITY.md` §9.

## 7. Dependências (verificadas no registro npm em 2026-11-25)

| Pacote | Versão estável observada | Nota |
|---|---|---|
| next | 16.4.6 | atende "Next.js 15+"; **confirmar** suporte oficial de `@supabase/ssr` e Serwist |
| react | 19.3.1 | |
| typescript | **6.0.3** (fixado) | TS 7.0.2 compila e builda com Next 16, mas `typescript-eslint` ainda não o suporta (erro verificado). Usar 6.x até haver suporte; reavaliar a cada release |
| tailwindcss | 4.3.5 | CSS-first config |
| @supabase/supabase-js / ssr | 2.119.2 / 0.12.7 | |
| zod | 4.6.7 | |
| react-hook-form | 7.92.0 | resolver Zod compatível a validar |
| vitest | 5.1.2 | |
| @playwright/test | 1.65.1 | |
| lucide-react | 1.80.0 | |

**Verificado no Gate 1:** Next 16.4.6 + React 19.3.1 + Tailwind 4.3.5 + Zod 4.6.7 + Vitest 5.1.2 + Playwright 1.65.1 + supabase-js/ssr instalam, compilam (`tsc`, `eslint`, `next build`) e passam nos testes. Exceção: TypeScript 7 (ver tabela).

## 8. Classificação

| Item | Status |
|---|---|
| Monólito modular | APPROVED (recomendação; aguarda revisão humana final) |
| Resolução de tenant por cookie validado | PENDING_REVIEW |
| Escopo Onda 1 / Onda 2 | PENDING_REVIEW |
| Matriz de versões | PENDING_REVIEW |
| Implementação de qualquer código de aplicação | NOT_IMPLEMENTED (por design no Gate 0) |


## 9. Desvios da árvore original (decididos na implementação)
| Desvio | Motivo |
|---|---|
| `src/proxy.ts` em vez de `middleware.ts` | Next 16 renomeou o arquivo (build reporta "Proxy (Middleware)") |
| Stage Mode em `src/app/(stage)/palco/[versionId]` (grupo próprio) | Precisa de layout sem navegação e tema escuro; `/palco` por **versão de música** enquanto o módulo de sessões/setlist não existe |
| Root layout `await connection()` | A CSP usa nonce por requisição; páginas estáticas não recebem nonce e perderiam JavaScript (bug real detectado e corrigido, coberto por E2E) |
| Fontes via `@fontsource*` (auto-hospedadas) | Build determinístico, sem depender de rede em tempo de build |
| `rate_limit_hit` via service role | Tabela de buckets fica fora do alcance de `authenticated` |
