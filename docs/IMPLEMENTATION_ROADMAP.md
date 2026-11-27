# IGREJAQUA — Roadmap de Implementação

Status: **PENDING_REVIEW**. Os Gates seguem o prompt "Master Engineering & Design" (G1 Design System → G7 Homologação). Nenhum Gate começa sem aprovação humana do anterior. Bloqueio crítico aberto = não avança.

Convenção de rollback: migrations versionadas com `down` documentado; deploys por Vercel com *instant rollback*; feature flags para módulos novos.

---

## GATE 1 — Design System e protótipos
- **Escopo:** scaffold do projeto (Next, TS strict, Tailwind, shadcn), tokens, tipografia, componentes base, rota interna `/design`, telas de referência (5) com dados de exemplo **apenas nesta rota interna não-produtiva**.
- **Dependências:** aprovação do Gate 0 e da direção visual.
- **Entregáveis:** `package.json` com versões fixadas e validadas em conjunto; ESLint com fronteiras; CI (tsc, lint, build, vitest, gitleaks); Design System; relatório de acessibilidade.
- **Riscos técnicos:** incompatibilidade entre majors (TS 7, Next 16, Vitest 5, Tailwind 4); fontes e CLS.
- **Segurança:** CSP inicial, sem segredos no repo, `.env.example`.
- **Testes:** build limpo, axe nos componentes, snapshot visual de tokens.
- **Aceite:** designer aprova; `tsc/lint/build` verdes; matriz de versões documentada.
- **Rollback:** descartar branch; nada em produção.

## GATE 2 — Banco, autenticação, multi-tenancy e RLS
- **Escopo:** migrations de todas as tabelas da Onda 1, enums, funções `private.*`, RLS, triggers, auditoria, Supabase Auth + SSR, `resolveChurchContext`, seed local.
- **Dependências:** G1; revisão humana de `DATABASE.md`/`SECURITY.md`/`RBAC.md`.
- **Entregáveis:** `supabase/migrations/*`, `supabase/tests/*` (pgTAP), tipos gerados, módulos `identity/churches/members`.
- **Riscos:** RLS lenta (índices/initplan); recursão de policies; trigger de convite; custo de FKs compostas.
- **Segurança:** RLS habilitada em todas as tabelas (`ENABLE`, não `FORCE` — ver ADR-0004), advisors limpos, service role isolado, teste cross-tenant 100%.
- **Testes:** pgTAP, matriz cross-tenant, paridade RBAC, integração de auth.
- **Aceite:** zero tabela sem RLS; zero vazamento cross-tenant; advisors sem erros.
- **Rollback:** migração reversa por versão; projeto Supabase de homologação separado; PITR.

## GATE 3 — Estrutura principal e navegação
- **Escopo:** AppShell, navegação por papel, seleção de igreja, dashboards vazios **reais** (estados vazios úteis), PWA base, notificações in-app.
- **Dependências:** G2.
- **Entregáveis:** rotas de `(app)` com guardas de servidor, `RoleGate`, service worker mínimo.
- **Riscos:** cache indevido de rotas autenticadas; flash de conteúdo por papel.
- **Segurança:** `no-store` em autenticadas; testes de acesso por rota.
- **Testes:** E2E de login/seleção/navegação em 3 papéis; axe.
- **Aceite:** matriz rota×papel passa; Lighthouse PWA/A11y ≥ metas acordadas.
- **Rollback:** feature flag de navegação; revert de deploy.

## GATE 4 — Módulos (Onda 1)
- **Escopo (ordem):** membros e convites → ministérios e permissões → eventos/sessões → disponibilidade → escalas manuais + confirmações → repertório e editor ChordPro → setlist → Stage Mode → comunicados/devocionais → oração e presença → PIX informativo.
- **Dependências:** G3.
- **Entregáveis:** funcionalidades completas com validação, persistência e RLS; Stage Mode com transposição.
- **Riscos:** parser ChordPro/transposição (casos de borda); concorrência em escalas; notificações duplicadas.
- **Segurança:** oração anônima (SECURITY §8); sanitização de markdown; uploads.
- **Testes:** R-01…R-28; E2E por fluxo crítico; offline do Stage.
- **Aceite:** cada módulo com testes verdes e evidência; revisão de segurança por módulo.
- **Rollback:** flags por módulo; migrações aditivas (expand/contract).

## GATE 5 — Integrações e avançados
- **Escopo:** motor de IA (DeepSeek), jobs agendados (publicação, retenção), Web Push, e-mail transacional, BR Code PIX, OAuth opcional, MFA admin.
- **Dependências:** G4; **parecer jurídico sobre transferência internacional** (IA).
- **Entregáveis:** pipeline completo de IA com validador e revisão humana; observabilidade.
- **Riscos:** custo/latência/indisponibilidade da API; validade do BR Code; entrega de push no iOS PWA.
- **Segurança:** minimização, rate limits, circuit breaker, sem segredos no cliente.
- **Testes:** validador com fixtures hostis; contrato real **manual** com a API; E2E de aceitação de proposta.
- **Aceite:** IA desligável; nenhuma publicação automática comprovada por teste.
- **Rollback:** `ai_enabled=false` global; flag por igreja.

## GATE 6 — Testes, segurança, performance e acessibilidade
- **Escopo:** hardening, pentest interno (OWASP Top 10), carga, auditoria WCAG 2.2 AA, revisão LGPD, restauração de backup.
- **Dependências:** G5.
- **Entregáveis:** relatório de segurança, relatório de performance (Core Web Vitals), restauração testada.
- **Riscos:** regressões de RLS por otimização; N+1.
- **Segurança:** varredura de dependências, headers, rate limits, revisão de políticas.
- **Testes:** suíte completa; carga com k6 em ambiente de homologação.
- **Aceite:** zero crítico/alto aberto; metas de LCP/INP/CLS atingidas.
- **Rollback:** congelamento de features; correções via hotfix com revisão.

## GATE 7 — Homologação e produção
- **Escopo:** piloto com a igreja, treinamento, monitoramento, runbooks, ROPA/LGPD, plano de incidentes, go-live.
- **Dependências:** G6.
- **Entregáveis:** checklist de produção assinado, runbooks, dashboards de monitoramento, termos/privacidade.
- **Riscos:** adoção; dados reais; suporte.
- **Segurança:** segregação de ambientes, rotação de chaves, acesso mínimo.
- **Testes:** UAT com usuários reais; smoke pós-deploy.
- **Aceite:** aprovação formal da igreja piloto e do responsável técnico.
- **Rollback:** rollback instantâneo + restauração PITR documentada.
