# ADR-0008 — Sessões de evento independentes
Status: PROPOSED
**Decisão:** `events` agrupa; `event_sessions` carregam horário, escala, setlist, RSVP e presença. Um mesmo dia pode ter ensaio e culto com equipes e repertórios distintos.
**Alternativas:** evento único com horário único (não modela ensaio+culto) ou eventos separados sem agrupamento (perde contexto e duplica cadastro).
**Trade-offs:** mais joins; compensado por visão agregada no detalhe do evento e regra de sobreposição R-07.
