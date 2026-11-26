# ADR-0003 — Estratégia de isolamento de tenant
Status: PROPOSED
**Decisão:** banco compartilhado, schema único, coluna `church_id` + RLS + FKs compostas `(church_id,id)`. Igreja ativa via cookie `iq_church` **revalidado** a cada requisição contra `church_memberships`.
**Alternativas:** (a) schema por tenant — migrações N× e pooling complexo; (b) projeto Supabase por igreja — isolamento máximo, custo e operação inviáveis agora; (c) `church_id` como claim no JWT — estado obsoleto após mudança de vínculo; (d) slug na URL — melhor para multi-aba, mas altera a árvore de rotas fornecida (pendente).
**Trade-offs:** risco de bug de política compensado por 3 camadas e teste cross-tenant automático. Revisitar (b) para clientes que exijam isolamento contratual.
