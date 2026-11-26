# ADR-0001 — Monólito modular em vez de microsserviços
Status: PROPOSED
**Contexto:** equipe pequena, uma igreja piloto, domínio fortemente relacional, necessidade de transações entre escala/evento/repertório.
**Decisão:** um deploy Next.js com módulos em `src/modules/*` e fronteiras impostas por lint.
**Alternativas:** (a) microsserviços — custo operacional, consistência distribuída, sem ganho para a escala atual; (b) monólito sem módulos — acopla e dificulta extrair partes depois.
**Trade-offs:** deploy único e escalonamento conjunto; mitigado por funções stateless e Postgres gerenciado. Extração futura (ex.: IA) é possível porque `lib/ai` só depende de DTOs.
