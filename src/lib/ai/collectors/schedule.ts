import "server-only";
import { z } from "zod";
import type { ScheduleFacts, Slot } from "@/lib/ai/schedule-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sessionRow = z.object({
  id: z.string().uuid(), church_id: z.string().uuid(), ministry_id: z.string().uuid().nullable(), starts_at: z.string(), ends_at: z.string(),
  events: z.object({ status: z.string() }),
});
const settingsRow = z.object({
  ai_enabled: z.boolean(),
  rotation_policy: z.object({
    window_weeks: z.number().int().min(1).max(52).default(8),
    max_gap: z.number().int().min(0).max(20).default(2),
    max_per_month: z.number().int().min(1).max(31).default(4),
    allow_multi_function: z.boolean().default(false),
  }).passthrough(),
});
const availabilityRow = z.object({ ministry_membership_id: z.string().uuid(), membership_id: z.string().uuid(), available: z.boolean() });
const memberRow = z.object({ id: z.string().uuid(), instruments: z.array(z.string()), voice_part: z.string().nullable() });
const directoryRow = z.object({ membership_id: z.string().uuid(), display_name: z.string() });
const lineupRow = z.object({
  session_id: z.string().uuid(), function: z.string(),
  ministry_memberships: z.object({ membership_id: z.string().uuid() }),
  event_sessions: z.object({ starts_at: z.string(), ends_at: z.string() }),
});

export type CollectOutcome =
  | { readonly kind: "ok"; readonly facts: ScheduleFacts }
  | { readonly kind: "not_found" }
  | { readonly kind: "no_ministry" }
  | { readonly kind: "ai_disabled" }
  | { readonly kind: "failed"; readonly message: string };

/** Coleta o contexto mínimo com o JWT do usuário (RLS aplica-se a tudo). */
export async function collectScheduleFacts(sessionId: string, slots: readonly Slot[], now: number): Promise<CollectOutcome> {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData, error: sessionError } = await supabase
    .from("event_sessions").select("id, church_id, ministry_id, starts_at, ends_at, events!inner(status)").eq("id", sessionId).maybeSingle();
  if (sessionError) return { kind: "failed", message: sessionError.message };
  if (sessionData === null) return { kind: "not_found" };
  const session = sessionRow.parse(sessionData);
  if (session.ministry_id === null) return { kind: "no_ministry" };

  const [settingsRes, churchRes, availabilityRes] = await Promise.all([
    supabase.from("church_settings").select("ai_enabled, rotation_policy").eq("church_id", session.church_id).maybeSingle(),
    supabase.from("churches").select("timezone").eq("id", session.church_id).maybeSingle(),
    supabase.rpc("get_ministry_availability", { p_session: sessionId, p_ministry: session.ministry_id }),
  ]);
  if (settingsRes.error || churchRes.error || availabilityRes.error) return { kind: "failed", message: (settingsRes.error ?? churchRes.error ?? availabilityRes.error)?.message ?? "erro" };
  if (settingsRes.data === null || churchRes.data === null) return { kind: "not_found" };
  const cfg = settingsRow.parse(settingsRes.data);
  if (!cfg.ai_enabled) return { kind: "ai_disabled" };
  const timezone = z.object({ timezone: z.string() }).parse(churchRes.data).timezone;
  const availability = z.array(availabilityRow).parse(availabilityRes.data);

  const mmIds = availability.map((a) => a.ministry_membership_id);
  const startsAt = Date.parse(session.starts_at);
  const windowFrom = new Date(startsAt - cfg.rotation_policy.window_weeks * 7 * 24 * 3_600_000 - 40 * 24 * 3_600_000).toISOString();
  const windowTo = new Date(startsAt + 40 * 24 * 3_600_000).toISOString();

  const [membersRes, directoryRes, lineupRes] = await Promise.all([
    mmIds.length === 0 ? { data: [], error: null } : supabase.from("ministry_memberships").select("id, instruments, voice_part").in("id", mmIds),
    supabase.rpc("church_directory", { p_church: session.church_id }),
    mmIds.length === 0
      ? { data: [], error: null }
      : supabase.from("event_lineup")
          .select("session_id, function, ministry_memberships!inner(membership_id), event_sessions!inner(starts_at, ends_at)")
          .eq("church_id", session.church_id).in("ministry_membership_id", mmIds).in("status", ["draft", "published", "confirmed"])
          .gte("event_sessions.starts_at", windowFrom).lte("event_sessions.starts_at", windowTo),
  ]);
  if (membersRes.error || directoryRes.error || lineupRes.error) return { kind: "failed", message: (membersRes.error ?? directoryRes.error ?? lineupRes.error)?.message ?? "erro" };

  const members = new Map(z.array(memberRow).parse(membersRes.data).map((m) => [m.id, m] as const));
  const names = new Map(z.array(directoryRow).parse(directoryRes.data).map((d) => [d.membership_id, d.display_name] as const));
  const lineup = z.array(lineupRow).parse(lineupRes.data).map((l) => ({
    sessionId: l.session_id, membershipId: l.ministry_memberships.membership_id, function: l.function,
    startsAt: Date.parse(l.event_sessions.starts_at), endsAt: Date.parse(l.event_sessions.ends_at),
  }));

  return {
    kind: "ok",
    facts: {
      churchId: session.church_id,
      ministryId: session.ministry_id,
      session: {
        id: session.id, churchId: session.church_id, ministryId: session.ministry_id, startsAt,
        endsAt: Date.parse(session.ends_at), cancelled: session.events.status === "cancelled" || session.events.status === "done", now,
      },
      policy: { maxGap: cfg.rotation_policy.max_gap, maxPerMonth: cfg.rotation_policy.max_per_month, allowMultiFunction: cfg.rotation_policy.allow_multi_function },
      windowWeeks: cfg.rotation_policy.window_weeks,
      timezone,
      people: availability.map((a) => {
        const m = members.get(a.ministry_membership_id);
        return {
          ministryMembershipId: a.ministry_membership_id, membershipId: a.membership_id, displayName: names.get(a.membership_id) ?? "Membro",
          functions: [...(m?.instruments ?? []), ...(m?.voice_part ? [m.voice_part] : [])], available: a.available,
        };
      }),
      lineup,
      slots,
    },
  };
}
