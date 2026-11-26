# ADR-0002 — Identidade global + vínculos por igreja
Status: PROPOSED
**Contexto:** uma pessoa pode participar de várias igrejas com papéis distintos.
**Decisão:** `profiles` (1:1 com `auth.users`) sem papel; `church_memberships(church_id, user_id, role, status)` como fonte do papel; ministérios via `ministry_memberships` + `ministry_permissions`.
**Alternativas:** (a) papel no perfil — impede multi-igreja e é fonte comum de escalada de privilégio; (b) um usuário Auth por igreja — duplica identidade e quebra login único.
**Trade-offs:** toda checagem exige `church_id`; resolvido por helpers SQL e `resolveChurchContext`.
