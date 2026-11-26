# ADR-0004 — RLS como barreira final de autorização
Status: PROPOSED
**Decisão:** RLS forçada em todas as tabelas; cliente com JWT do usuário em toda operação normal; funções `SECURITY DEFINER` em schema `private` com `search_path=''`; políticas por operação com `WITH CHECK`.
**Alternativas:** autorização só na aplicação (falha silenciosa se esquecida) ou RLS só leitura. 
**Trade-offs:** custo de desempenho e complexidade de políticas; mitigados por índices em `(church_id, …)`, `(select auth.uid())` e testes pgTAP. `capabilities.ts` é a fonte única que gera/verifica app e SQL.
