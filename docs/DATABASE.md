# IGREJAQUA — Modelo de Dados

Status: **PENDING_REVIEW**. Nenhuma migration foi criada (exigência do Gate 0).

## 1. Convenções

- PK: `uuid` (`gen_random_uuid()`), exceto `profiles.id` = `auth.users.id`.
- Timestamps: `created_at timestamptz not null default now()`, `updated_at` com trigger `set_updated_at`.
- Todo dado de igreja tem `church_id uuid not null`.
- **Integridade de tenant:** toda tabela filha referencia o pai por **FK composta** `(church_id, parent_id)`, e todo pai tenant-owned declara `unique (church_id, id)`. Assim é impossível ligar linha da igreja A a pai da igreja B, mesmo com service role.
- Exclusão: `ON DELETE RESTRICT` por padrão; `CASCADE` só dentro do mesmo agregado (evento → sessões → escala/setlist). Conteúdo de negócio usa `deleted_at` (soft delete). Ver §7.
- Idioma: nomes de tabela/coluna em inglês; textos de UI em pt-BR.
- Fuso: `timestamptz` + `churches.timezone` (default `America/Sao_Paulo`); exibição converte no cliente/servidor.
- Extensões: `pgcrypto`, `citext` (e-mail), `btree_gist` (exclusion constraints), `pg_trgm` (busca de músicas).

## 2. Enums

| Enum | Valores |
|---|---|
| `church_status` | `active`, `suspended`, `archived` |
| `membership_role` | `admin`, `leader`, `member` |
| `membership_status` | `invited`, `active`, `suspended`, `left` |
| `ministry_member_role` | `coordinator`, `member` |
| `ministry_permission` | `manage_ministry`, `manage_members`, `manage_schedule`, `publish_schedule`, `manage_repertoire`, `manage_rehearsals`, `manage_content`, `view_availability` |
| `event_kind` | `service`, `rehearsal`, `special`, `meeting` |
| `event_status` | `draft`, `scheduled`, `cancelled`, `done` |
| `lineup_status` | `draft`, `published`, `confirmed`, `declined`, `replaced`, `cancelled` |
| `content_kind` | `announcement`, `devotional` |
| `content_status` | `draft`, `scheduled`, `published`, `archived` |
| `rsvp_status` | `going`, `not_going`, `maybe` |
| `ai_run_kind` | `schedule`, `repertoire`, `vocal_key`, `rehearsal_plan`, `transitions` |
| `ai_run_status` | `pending`, `generated`, `validation_failed`, `validated`, `accepted`, `discarded`, `error` |
| `notification_channel` | `in_app`, `push`, `email` |
| `prayer_status` | `open`, `answered`, `archived`, `removed` |
| `pix_key_type` | `cpf`, `cnpj`, `email`, `phone`, `random` |

## 3. Tabelas globais (sem `church_id`)

### `profiles`
`id uuid PK → auth.users(id) ON DELETE CASCADE`, `full_name text not null`, `display_name text`, `avatar_path text`, `phone text`, `locale text default 'pt-BR'`, `created_at`, `updated_at`, `deleted_at`.
**Sem coluna de papel.** Criada por trigger `on auth.users insert` (SECURITY DEFINER). RLS: o próprio usuário lê/edita; outros usuários só enxergam o perfil de quem compartilha igreja ativa (via função, e apenas colunas exibíveis através da view `member_directory`).

### `churches`
`id`, `slug citext unique`, `name`, `legal_name`, `document_number` (CNPJ, opcional), `timezone`, `status church_status`, `created_by`, timestamps.
RLS: leitura por membros ativos; escrita por admin da igreja.

## 4. Tabelas por igreja

Todas têm `church_id uuid not null references churches(id)` e `unique (church_id, id)`.

| Tabela | Colunas principais | Constraints / índices |
|---|---|---|
| `church_memberships` | `user_id → profiles`, `role`, `status`, `is_owner bool`, `joined_at`, `invited_by`, `member_code`? | `unique (church_id, user_id)`; idx `(user_id, status)`; trigger anti-escalada e "último admin" |
| `church_settings` | `church_id PK/FK`, `locale`, `week_starts_on`, `rotation_policy jsonb`, `ai_enabled bool`, `ai_data_sharing_consent_at`, `stage_defaults jsonb`, `retention_policy jsonb` | 1:1 com igreja |
| `ministries` | `name`, `slug`, `kind` (louvor, mídia, infantil…), `description`, `color_token`, `archived_at` | `unique (church_id, slug)` |
| `ministry_memberships` | `ministry_id`, `membership_id`, `role ministry_member_role`, `instruments text[]`, `voice_part`, `vocal_range_low/high` (nota MIDI), `active` | FK composta para `ministries` e `church_memberships`; `unique (church_id, ministry_id, membership_id)` |
| `ministry_permissions` | `ministry_membership_id`, `permission ministry_permission`, `granted_by`, `granted_at` | `unique (church_id, ministry_membership_id, permission)` |
| `unavailabilities` | `membership_id`, `during daterange`, `weekdays smallint[]`, `reason text` (**privado**), `created_at` | `exclude using gist (church_id with =, membership_id with =, during with &&)` quando `weekdays is null`; idx GiST em `during` |
| `songs` | `title`, `artist`, `default_key`, `tags text[]`, `language`, `copyright_notice`, `ccli_number`, `deleted_at` | GIN trgm em `title`; `unique (church_id, id)` |
| `song_versions` | `song_id`, `label`, `original_key`, `chordpro text` (na tonalidade original), `bpm`, `time_signature`, `capo`, `duration_s`, `status content_status`, `is_default`, `created_by` | `unique (church_id, song_id, label)`; **uma** default por música (partial unique); limite de tamanho no `chordpro` (check ≤ 64 KB) |
| `events` | `title`, `kind`, `status`, `starts_at`, `ends_at`, `location`, `description`, `recurrence_id`, `created_by` | idx `(church_id, starts_at)`; check `ends_at > starts_at` |
| `event_sessions` | `event_id`, `name`, `starts_at`, `ends_at`, `location`, `ministry_id?`, `position` | FK composta; ON DELETE CASCADE do evento; check de janela |
| `event_lineup` | `session_id`, `ministry_id`, `ministry_membership_id`, `function` (vocal, violão, bateria…), `status lineup_status`, `source` (`manual`/`ai`), `ai_run_id?`, `responded_at`, `note` | `unique (church_id, session_id, ministry_membership_id, function)`; **exclusion**: mesma pessoa não pode ter dois lineups ativos em sessões que se sobrepõem (trigger, ver DOMAIN_RULES R-07) |
| `event_setlist` | `session_id`, `song_version_id`, `position`, `target_key`, `capo_override`, `transition_note`, `lead_membership_id?` | `unique (church_id, session_id, position) deferrable`; FK composta para `song_versions` |
| `announcements_and_devotionals` | `kind`, `title`, `body_md`, `audience` (`church`/`ministry`), `ministry_id?`, `status`, `publish_at`, `published_at`, `scripture_ref`, `author_membership_id` | check audience↔ministry_id; body sanitizado na saída |
| `event_rsvps` | `session_id`, `membership_id`, `status`, `guests smallint`, `responded_at` | `unique (church_id, session_id, membership_id)` |
| `notifications` | `user_id`, `category`, `title`, `body`, `link_path`, `read_at`, `dedupe_key` | idx `(user_id, read_at)`; `unique (church_id, user_id, dedupe_key)` |
| `notification_preferences` | `user_id`, `category`, `channel`, `enabled` | `unique (church_id, user_id, category, channel)` |
| `ai_generation_runs` | `kind`, `status`, `requested_by`, `input_digest` (hash, sem PII), `prompt_version`, `model`, `request_token_count`, `response_token_count`, `raw_output jsonb` (**sem nomes**; só tokens pseudônimos), `validation_report jsonb`, `target_session_id?`, `accepted_at` | escrita apenas via servidor; leitura por quem tem `manage_schedule` |
| `contributions` | `title`, `description`, `pix_key_type`, `pix_key`, `beneficiary_name`, `city`, `brcode_payload` (gerado no servidor), `visible bool`, `valid_until`, `position` | **informativa**: sem valores recebidos nem pagador; ver SECURITY §11 |
| `audit_logs` | `actor_user_id`, `actor_membership_id`, `action`, `entity_table`, `entity_id`, `diff jsonb` (campos alterados, **sem** valores sensíveis), `ip_hash`, `user_agent_hash`, `request_id`, `created_at` | append-only: `REVOKE UPDATE, DELETE`; particionável por mês; idx `(church_id, created_at desc)` |

## 5. Entidades adicionais identificadas (necessárias)

| Tabela | Por quê |
|---|---|
| `church_invitations` | convite com `token_hash`, `email`, `role`, `expires_at`, `accepted_at`; tokens nunca em texto puro |
| `prayer_requests` | pedidos de oração: `body`, `status`, `is_anonymous`, `ministry_id?` — **sem coluna de autor** |
| `prayer_request_authors` | `prayer_request_id`, `membership_id` — tabela separada com RLS mais restrita (ver SECURITY §8) |
| `prayer_interactions` | "estou orando" (contagem); `unique (church_id, prayer_request_id, membership_id)` |
| `attendance_records` | presença por sessão: `session_id`, `membership_id`, `checked_in_at`, `method` (`self`/`leader`/`qr`) |
| `push_subscriptions` | endpoint Web Push por usuário/dispositivo (criptografado em repouso via Supabase Vault ou coluna protegida) |
| `data_subject_requests` | pedidos LGPD (acesso, correção, eliminação, portabilidade), com prazo e responsável |
| `consent_records` | consentimentos versionados (termos, compartilhamento com IA, imagem) |
| `rate_limit_buckets` | contadores para rate limiting no Postgres (ver SECURITY §6) — tabela **global**, sem RLS para o cliente |
| `idempotency_keys` | evita duplo-submit de mutações críticas (publicar escala, aceitar convite) |
| `vocal_profiles` (opcional; hoje dentro de `ministry_memberships`) | PENDING_REVIEW: separar se um membro tiver faixa vocal independente do ministério |

## 6. Funções de apoio (schema `private`, `SECURITY DEFINER`, `search_path = ''`)

- `private.is_active_member(p_church uuid) → boolean`
- `private.has_church_role(p_church uuid, p_roles membership_role[]) → boolean`
- `private.has_ministry_permission(p_church uuid, p_ministry uuid, p_perm ministry_permission) → boolean`
- `private.current_membership_id(p_church uuid) → uuid`
- `private.shared_church_with(p_user uuid) → boolean`
- `get_ministry_availability(p_session uuid)` (RPC): devolve apenas `membership_id` + `available bool` — **nunca** `reason`.

Todas usam `(select auth.uid())` para permitir cache de initplan e são revogadas de `anon`/`public`.

## 7. Política de exclusão e retenção

| Entidade | Política |
|---|---|
| `churches` | `archived`; hard delete só por procedimento manual documentado (exportação + janela de 30 dias) |
| `church_memberships` | `status='left'`; histórico preservado para auditoria; dados pessoais anonimizados sob pedido LGPD |
| `songs`, `song_versions`, `events`, `announcements_and_devotionals` | soft delete (`deleted_at`); purga após 12 meses |
| `event_*` filhos | CASCADE dentro do evento só enquanto o evento está em `draft`; evento `done` não é deletável |
| `prayer_requests` | `removed` oculta; purga do texto após 24 meses (configurável); `prayer_request_authors` purgada junto |
| `notifications` | 90 dias após `read_at` |
| `audit_logs` | 5 anos (ver SECURITY §10); nunca editável |
| `ai_generation_runs` | 12 meses; `raw_output` apagado em 90 dias |

## 8. Triggers

`set_updated_at` (todas); `audit_row_change` (tabelas sensíveis); `profiles_on_signup`; `memberships_guard` (impede auto-promoção, remoção do último admin e mudança de `user_id`); `lineup_no_overlap`; `setlist_same_church_guard` (defesa em profundidade além da FK composta); `content_publish_guard` (só publica com permissão e muda `published_at`).

## 9. Onda 2 (migration `20261126001800`)

Tabelas: `families`, `family_members`, `visitors`, `visit_followups`, `cell_groups`, `cell_members`, `cell_meetings`, `cell_meeting_attendance`, `finance_categories`, `finance_entries`. Mesmas convenções (`church_id`, FK composta, RLS ENABLE, auditoria só com nomes de colunas). Testes: `supabase/tests/110_wave2.sql`.

- **Famílias:** menor de idade exige responsável na família; vínculo a membro OU nome (nunca ambos). Visível/gerenciado por quem tem `manage_members` em algum ministério e pela administração.
- **Visitantes (LGPD):** telefone/e-mail só são guardados com `contact_consent_at`; exclusão (direito ao apagamento) só pela administração, com cascata nos acompanhamentos. Retenção: `private.run_retention()` apaga telefone/e-mail/consentimento de visitantes sem atividade há 365 dias (ajustável em `retention_policy.visitor_contact_days`); nome e acompanhamentos permanecem até o apagamento pela administração.
- **Células:** gestão pela administração; presença por reunião.
- **Financeiro (`finance_entries`):** livro-caixa só da administração, sem atribuição por pessoa, append-only (somente anulação, sem permissão de DELETE). Requer revisão LGPD antes de produção.

## 10. Classificação

| Item | Status |
|---|---|
| Modelo lógico e convenções | PENDING_REVIEW |
| DDL / migrations | NOT_IMPLEMENTED (aguarda aprovação — Gate 2) |
| Separação autor/pedido de oração | PENDING_REVIEW |
| Livro-caixa (`finance_entries`) | IMPLEMENTED; revisão LGPD recomendada antes de produção |
