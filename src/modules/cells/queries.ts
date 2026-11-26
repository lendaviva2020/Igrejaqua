import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CellRow = z.object({ id: z.string().uuid(), name: z.string(), leader_membership_id: z.string().uuid(), weekday: z.number().nullable(), meeting_time: z.string().nullable(), location: z.string().nullable(), active: z.boolean() });
export type CellItem = z.infer<typeof CellRow>;

export async function listCells(churchId: string): Promise<readonly CellItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("cell_groups").select("id, name, leader_membership_id, weekday, meeting_time, location, active").eq("church_id", churchId).order("name");
  if (error) throw new Error(`Falha ao listar células: ${error.message}`);
  return z.array(CellRow).parse(data);
}

export async function getCell(churchId: string, cellId: string): Promise<CellItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("cell_groups").select("id, name, leader_membership_id, weekday, meeting_time, location, active").eq("church_id", churchId).eq("id", cellId).maybeSingle();
  if (error) throw new Error(`Falha ao carregar a célula: ${error.message}`);
  return data === null ? null : CellRow.parse(data);
}

const MeetingRow = z.object({ id: z.string().uuid(), held_on: z.string(), topic: z.string().nullable(), notes: z.string().nullable(), cell_meeting_attendance: z.array(z.object({ membership_id: z.string().uuid() })) });
export interface MeetingItem { readonly id: string; readonly heldOn: string; readonly topic: string | null; readonly notes: string | null; readonly attendeeIds: readonly string[] }

export async function listCellMeetings(churchId: string, cellId: string): Promise<readonly MeetingItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("cell_meetings").select("id, held_on, topic, notes, cell_meeting_attendance(membership_id)").eq("church_id", churchId).eq("cell_id", cellId).order("held_on", { ascending: false }).limit(52);
  if (error) throw new Error(`Falha ao listar reuniões: ${error.message}`);
  return z.array(MeetingRow).parse(data).map((m) => ({ id: m.id, heldOn: m.held_on, topic: m.topic, notes: m.notes, attendeeIds: m.cell_meeting_attendance.map((a) => a.membership_id) }));
}

export async function listCellMemberIds(churchId: string, cellId: string): Promise<readonly string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("cell_members").select("membership_id").eq("church_id", churchId).eq("cell_id", cellId);
  if (error) throw new Error(`Falha ao listar participantes: ${error.message}`);
  return z.array(z.object({ membership_id: z.string().uuid() })).parse(data).map((r) => r.membership_id);
}
