import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Portabilidade (LGPD art. 18, V): dados do próprio titular, lidos com a sessão dele (RLS). Pedidos de oração não entram (anonimato, R-24). */
export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers: { "cache-control": "no-store" } });
  const uid = auth.user.id;
  const [profile, memberships, dsr, consents, prefs] = await Promise.all([
    supabase.from("profiles").select("full_name, display_name, phone, locale, created_at").eq("id", uid).maybeSingle(),
    supabase.from("church_memberships").select("id, church_id, role, status, joined_at").eq("user_id", uid),
    supabase.from("data_subject_requests").select("kind, status, details, created_at, resolved_at").eq("user_id", uid),
    supabase.from("consent_records").select("purpose, version, granted, created_at").eq("user_id", uid),
    supabase.from("notification_preferences").select("*").eq("user_id", uid),
  ]);
  const mine = (memberships.data ?? []).map((m) => (m as { id: string }).id);
  const mm = mine.length === 0 ? { data: [] } : await supabase.from("ministry_memberships").select("id").in("membership_id", mine);
  const mmIds = (mm.data ?? []).map((m) => (m as { id: string }).id);
  const [rsvps, unavailabilities, lineup] = await Promise.all([
    mine.length === 0 ? { data: [] } : supabase.from("event_rsvps").select("*").in("membership_id", mine),
    mine.length === 0 ? { data: [] } : supabase.from("unavailabilities").select("*").in("membership_id", mine),
    mmIds.length === 0 ? { data: [] } : supabase.from("event_lineup").select("*").in("ministry_membership_id", mmIds),
  ]);
  const body = {
    generatedAt: new Date().toISOString(),
    email: auth.user.email ?? null,
    profile: profile.data ?? null,
    memberships: memberships.data ?? [],
    eventRsvps: rsvps.data ?? [],
    unavailabilities: unavailabilities.data ?? [],
    lineup: lineup.data ?? [],
    notificationPreferences: prefs.data ?? [],
    dataSubjectRequests: dsr.data ?? [],
    consents: consents.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="meus-dados-igrejaqua.json"', "cache-control": "no-store" },
  });
}
