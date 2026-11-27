# ADR-0004 — RLS como barreira final de autorização
Status: PROPOSED
**Decisão:** RLS habilitada (`ENABLE`, não `FORCE`) em todas as tabelas de `public`; cliente com JWT do usuário em toda operação normal; funções `SECURITY DEFINER` em schema `private` com `search_path=''`; políticas por operação com `WITH CHECK`.
**Ajuste na implementação:** `FORCE` não é usado porque as funções `SECURITY DEFINER` de `private` leem `church_memberships` como dono da tabela e `FORCE` as sujeitaria à própria RLS (recursão). `anon`/`authenticated` nunca são donos, então a RLS vale para eles; `GRANT`s mínimos por papel completam a defesa. Ver `docs/SECURITY.md` e `supabase/migrations/20261126000600_rls_policies_grants.sql`.
**Alternativas:** autorização só na aplicação (falha silenciosa se esquecida) ou RLS só leitura. 
**Trade-offs:** custo de desempenho e complexidade de políticas; mitigados por índices em `(church_id, …)`, `(select auth.uid())` e testes pgTAP. `capabilities.ts` é a fonte única que gera/verifica app e SQL.
