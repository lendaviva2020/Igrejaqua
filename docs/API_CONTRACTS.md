# IGREJAQUA — Contratos de API

Status: **PENDING_REVIEW**. Contratos de desenho; sem implementação.

## 1. Estratégia
- **Server Actions** para mutações de formulário na UI (tipadas, sem endpoint público).
- **Route Handlers** apenas para: IA (`/api/ai/*`), webhooks, exportações/streaming, e job agendado.
- Leituras: Server Components + `queries.ts`. Sem camada REST paralela em duplicidade.

## 2. Envelope padrão
```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fields?: Record<string, string[]>; requestId: string } };

type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION'
  | 'CONFLICT' | 'RULE_VIOLATION' | 'RATE_LIMITED' | 'AI_UNAVAILABLE' | 'INTERNAL';
```
HTTP: 401, 403, 404, 422 (VALIDATION/RULE_VIOLATION), 409, 429, 503, 500. Mensagens não vazam SQL ou stack. `requestId` correlaciona com `audit_logs`/logs.

## 3. Server Actions (nome → entrada → regra)
| Módulo | Action | Autorização | Notas |
|---|---|---|---|
| identity | `signUp`, `signIn`, `requestPasswordReset` | pública + rate limit | |
| churches | `createChurch`, `switchChurch`, `updateChurchSettings` | autenticado / admin | `switchChurch` valida vínculo e seta cookie |
| members | `inviteMember`, `acceptInvitation`, `changeMemberRole`, `suspendMember` | admin | R-02 |
| ministries | `createMinistry`, `addMinistryMember`, `grantMinistryPermission`, `revokeMinistryPermission` | admin / P | anti-escalada |
| events | `createEvent`, `addSession`, `updateSession`, `cancelEvent` | P `manage_*` | R-06 |
| schedules | `setLineup`, `publishSchedule`, `respondToLineup`, `requestSubstitute` | P / próprio usuário | R-07…R-15 |
| repertoire | `createSong`, `saveSongVersion`, `setSetlist` | P `manage_repertoire` | R-16…R-19 |
| stage | `getStagePayload(sessionId, targetKey?)` | membro com acesso à sessão | cache-friendly |
| availability | `declareUnavailability`, `removeUnavailability` | próprio | |
| community | `createPrayerRequest`, `prayFor`, `moderatePrayer`, `checkIn`, `rsvp` | membro | R-24..R-26 |
| content | `saveContent`, `publishContent` | P `manage_content` | |
| notifications | `markRead`, `updatePreferences`, `registerPushSubscription` | próprio | |
| privacy | `requestDataExport`, `requestErasure` | próprio | LGPD |

Cada Action: `parse(Zod.strict) → resolveChurchContext → can() → regra de domínio → repository → audit`.

## 4. Route Handlers
| Método e caminho | Entrada (Zod) | Saída | Observações |
|---|---|---|---|
| `POST /api/ai/schedule` | `{ sessionId, ministryId, functions[], options? }` | `{ runId, status, proposal?, violations[] }` | P `manage_schedule`; rate limit; **nunca publica** |
| `POST /api/ai/repertoire` | `{ sessionId, theme?, targetDurationMin }` | idem | P `manage_repertoire` |
| `POST /api/ai/vocal-key` | `{ songVersionId, leadMembershipId }` | `{ recommendedKey, semitones, rationale }` | tom calculado em código |
| `POST /api/ai/rehearsal-plan` | `{ sessionId, durationMin }` | `{ blocks[] }` | |
| `POST /api/ai/transitions` | `{ sessionId }` | `{ pairs[] }` | |
| `POST /api/ai/runs/{id}/accept` | `{}` | `{ lineupIds[] }` | cria **rascunho** |
| `POST /api/webhooks/supabase-auth` | assinatura | `204` | verifica assinatura HMAC; sem session |
| `GET /api/cron/publish-scheduled` | header de segredo | `{ published: n }` | Vercel Cron; idempotente |
| `GET /api/cron/retention` | header de segredo | `{ purged: {...} }` | LGPD |
| `GET /api/export/me` | — | JSON/ZIP | titular; auditado |

## 5. Esquemas Zod (exemplo de contrato)
```ts
export const SetLineupInput = z.object({
  sessionId: z.string().uuid(),
  entries: z.array(z.object({
    ministryMembershipId: z.string().uuid(),
    function: z.string().min(1).max(60),
    note: z.string().max(280).optional(),
  })).min(1).max(40),
}).strict();
```
`church_id` **nunca** aparece em entradas de cliente.

## 6. Versionamento e compatibilidade
Contratos internos; mudanças de `ai_*` exigem bump de `prompt_version`/`schema_version` registrados em `ai_generation_runs`.

## Classificação
PENDING_REVIEW · NOT_IMPLEMENTED
