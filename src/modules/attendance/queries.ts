import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({ id: z.string().uuid(), session_id: z.string().uuid(), membership_id: z.string().uuid(), method: z.enum(["self", "leader", "qr"]), checked_in_at: z.string() });
const Dir = z.object({ membership_id: z.string().uuid(), display_name: z.string(), status: z.enum(["invited", "active", "suspended", "left"]) });
export interface AttendanceEntry { readonly id: string; readonly membershipId: string; readonly name: string; readonly method: "self" | "leader" | "qr"; readonly checkedInAt: string }
export interface AttendanceSummary {
  readonly mineBySession: Readonly<Record<string, boolean>>;
  readonly entriesBySession: Readonly<Record<string, readonly AttendanceEntry[]>>;
  readonly people: readonly { readonly membershipId: string; readonly name: string }[];
}

/** RLS: membro comum só enxerga a própria presença; quem gerencia escala enxerga todas. */
export async function getAttendance(churchId: string, membershipId: string, sessionIds: readonly string[], includePeople: boolean): Promise<AttendanceSummary> {
  if (sessionIds.length === 0) return { mineBySession: {}, entriesBySession: {}, people: [] };
  const supabase = await createSupabaseServerClient();
  const [rows, dir] = await Promise.all([
    supabase.from("attendance_records").select("id, session_id, membership_id, method, checked_in_at").eq("church_id", churchId).in("session_id", [...sessionIds]).order("checked_in_at"),
    includePeople ? supabase.rpc("church_directory", { p_church: churchId }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (rows.error) throw new Error(`Falha ao carregar presença: ${rows.error.message}`);
  if (dir.error) throw new Error(`Falha ao carregar pessoas: ${dir.error.message}`);
  const people = z.array(Dir).parse(dir.data).filter((p) => p.status === "active");
  const names = new Map(people.map((p) => [p.membership_id, p.display_name]));
  const mine: Record<string, boolean> = {};
  const by: Record<string, AttendanceEntry[]> = {};
  for (const r of z.array(Row).parse(rows.data)) {
    if (r.membership_id === membershipId) mine[r.session_id] = true;
    if (includePeople) (by[r.session_id] ??= []).push({ id: r.id, membershipId: r.membership_id, name: names.get(r.membership_id) ?? "Pessoa", method: r.method, checkedInAt: r.checked_in_at });
  }
  return { mineBySession: mine, entriesBySession: by, people: people.map((p) => ({ membershipId: p.membership_id, name: p.display_name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
}
