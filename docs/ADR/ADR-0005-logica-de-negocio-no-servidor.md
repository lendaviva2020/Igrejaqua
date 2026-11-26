# ADR-0005 — Regras de negócio no servidor (Server Actions/Route Handlers)
Status: PROPOSED
**Decisão:** validação Zod + regras em `modules/*/domain` executadas no servidor; o banco reforça invariantes (constraints/triggers/RLS). Clientes nunca falam diretamente com tabelas de negócio (sem `supabase-js` em componentes).
**Alternativas:** (a) lógica em RPC/PL/pgSQL — forte, mas difícil de testar/evoluir; (b) cliente direto com RLS — expõe superfície e regras.
**Trade-offs:** latência extra por hop; ganho em testabilidade e auditoria. Exceções: Realtime futuro (somente leitura, por RLS).
