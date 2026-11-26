# IGREJAQUA — Estratégia de Testes

Status: **PENDING_REVIEW**

## 1. Pirâmide
| Nível | Ferramenta | Alvo | Onde |
|---|---|---|---|
| Unidade | Vitest | `modules/*/domain`, `lib/music-theory`, `lib/chords`, `lib/permissions`, `lib/ai/validators`, `lib/security` | `tests/unit` |
| Banco / RLS | pgTAP via `supabase test db` | políticas, FKs compostas, triggers, funções | `supabase/tests` |
| Integração | Vitest + Supabase local | repositories, Server Actions, Route Handlers com JWTs de teste | `tests/integration` |
| Segurança | Vitest + Playwright | isolamento entre igrejas, bundle sem segredos, headers, rate limit | `tests/security` |
| E2E | Playwright | fluxos críticos mobile + desktop | `tests/e2e` |
| A11y | axe-core em Playwright | todas as rotas | `tests/e2e` |

## 2. Suítes obrigatórias
1. **Cross-tenant matrix:** para cada tabela com `church_id`, 4 operações × (membro A→B, admin A→B, anon). Esperado: negado. Gerada a partir do catálogo `information_schema` para que tabela nova sem teste quebre o CI.
2. **Paridade RBAC:** `capabilities.ts` ↔ políticas RLS (mesma tabela de verdade).
3. **Oração anônima:** nenhum papel exceto o autor lê `prayer_request_authors`; revelar exige permissão e gera `audit_logs`.
4. **Transposição:** propriedades (`transpose(x, n)` ∘ `transpose(·, −n)` = identidade; ciclo de 12), casos de bemol/sustenido, acordes com baixo (`C/E`), extensões (`Cmaj7`, `Dsus4`, `F#m7b5`).
5. **ChordPro:** parser com corpus de arquivos reais anonimizados; entrada maliciosa (HTML/script) não gera saída executável.
6. **Regras R-01…R-28:** um teste por regra, nomeado pelo ID.
7. **IA:** saída do LLM *mockada em fixture* (somente em teste) → validador rejeita membro inexistente, sobreposição, indisponível, música de outra igreja, campos extras. Teste de contrato da API real é manual no Gate 5.
8. **Concorrência:** duas publicações simultâneas da mesma escala; duplo submit com `idempotency_keys`.
9. **Segredos:** build + varredura de `.next/static` por chaves.
10. **Offline/PWA:** Stage Mode abre offline após primeiro carregamento; logout limpa cache.

## 3. Portões de qualidade por Gate
`tsc --noEmit` · `eslint` (inclui fronteiras de módulo) · `next build` · Vitest · pgTAP · Playwright (Chromium + WebKit mobile) · axe · `gitleaks` · advisors do Supabase. Resultados registrados em `docs/GATES/GATE_N_REPORT.md` — falha ou omissão = gate não aprovado.

## 4. Dados de teste
Fixtures sintéticas determinísticas em `supabase/seed.sql` apenas para ambiente `local/test`; produção não executa seed (verificado por guarda no script). Duas igrejas fictícias, 5 usuários cobrindo todos os papéis.

## 5. Evidência
"Concluído" exige saída de comando anexada ao relatório do gate (NEVER declarar sem evidência funcional).

## Classificação
PENDING_REVIEW · NOT_IMPLEMENTED
