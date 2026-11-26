# ADR-0009 — Auditoria e arquitetura de privacidade
Status: PROPOSED
**Decisão:** `audit_logs` append-only por trigger/REVOKE, sem valores sensíveis; oração anônima com autor em tabela separada; motivo de indisponibilidade visível só ao titular; minimização para IA; retenção por job; direitos LGPD via `data_subject_requests`.
**Alternativas:** log em arquivo/serviço externo (perde correlação com RLS); armazenar autor na própria oração com política de coluna (fraco: admin/service role leem).
**Trade-offs:** mais tabelas e funções; moderação mais trabalhosa — aceito por proteger o titular.
