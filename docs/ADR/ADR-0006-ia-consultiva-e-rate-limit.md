# ADR-0006 — IA como motor consultivo; rate limiting no Postgres
Status: PROPOSED
**Decisão IA:** DeepSeek apenas no servidor, saída validada por Zod e por camada determinística, revisão humana obrigatória, nunca publica. Dados pseudonimizados.
**Decisão rate limit:** tabela `rate_limit_buckets` + RPC atômica. **Alternativas:** Upstash Redis (mais rápido; dependência/custo extra), limites só no edge da Vercel (granularidade pobre).
**Trade-offs:** Postgres adiciona carga de escrita; aceitável no piloto; reavaliar se p95 de login degradar. Provedor de IA: risco LGPD de transferência internacional (BLOCKED até parecer).
