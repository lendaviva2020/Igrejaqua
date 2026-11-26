"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CellIdSchema, CellMemberSchema, CreateCellSchema, RecordMeetingSchema } from "./schemas";

export async function createCellAction(input: unknown): Promise<Result<{ created: true }>> {
  const parsed = CreateCellSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "cell.manage")) return fail("FORBIDDEN", "Apenas a administração cria células.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cell_groups").insert({
    church_id: ctx.churchId,
    name: parsed.data.name,
    leader_membership_id: parsed.data.leaderMembershipId,
    weekday: parsed.data.weekday ?? null,
    meeting_time: parsed.data.meetingTime ?? null,
    location: parsed.data.location ?? null,
  });
  if (error) return error.code === "23505" ? fail("CONFLICT", "Já existe uma célula com este nome.", { name: ["Nome já em uso"] }) : fromPostgrestError(error);
  revalidatePath("/celulas");
  return ok({ created: true });
}

/** Líder da célula ou administração (a RLS reforça); o líder também é participante implícito. */
export async function addCellMemberAction(input: unknown): Promise<Result<{ added: true }>> {
  const parsed = CellMemberSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cell_members").insert({ church_id: ctx.churchId, cell_id: parsed.data.cellId, membership_id: parsed.data.membershipId });
  if (error) return error.code === "23505" ? fail("CONFLICT", "Esta pessoa já participa da célula.") : fromPostgrestError(error);
  revalidatePath(`/celulas/${parsed.data.cellId}`);
  return ok({ added: true });
}

export async function removeCellMemberAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = CellMemberSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("cell_members").delete().eq("church_id", ctx.churchId).eq("cell_id", parsed.data.cellId).eq("membership_id", parsed.data.membershipId).select("id");
  if (error) return fromPostgrestError(error);
  if (data.length === 0) return fail("FORBIDDEN", "Você não pode remover esta pessoa.");
  revalidatePath(`/celulas/${parsed.data.cellId}`);
  return ok({ removed: true });
}

export async function recordMeetingAction(input: unknown): Promise<Result<{ recorded: true }>> {
  const parsed = RecordMeetingSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { data: meeting, error } = await supabase.from("cell_meetings").insert({
    church_id: ctx.churchId, cell_id: parsed.data.cellId, held_on: parsed.data.heldOn, topic: parsed.data.topic ?? null, notes: parsed.data.notes ?? null,
  }).select("id").single();
  if (error) return error.code === "23505" ? fail("CONFLICT", "Já existe reunião registrada nesta data.", { heldOn: ["Data já registrada"] }) : fromPostgrestError(error);
  const meetingId = (meeting as { id: string }).id;
  if (parsed.data.attendees.length > 0) {
    const { error: attError } = await supabase.from("cell_meeting_attendance").insert(parsed.data.attendees.map((membershipId) => ({ church_id: ctx.churchId, meeting_id: meetingId, membership_id: membershipId })));
    if (attError) {
      // Sem presença válida a reunião não fica pela metade
      await supabase.from("cell_meetings").delete().eq("church_id", ctx.churchId).eq("id", meetingId);
      return fromPostgrestError(attError);
    }
  }
  revalidatePath(`/celulas/${parsed.data.cellId}`);
  return ok({ recorded: true });
}

export async function deactivateCellAction(input: unknown): Promise<Result<{ updated: true }>> {
  const parsed = CellIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Célula inválida.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "cell.manage")) return fail("FORBIDDEN", "Apenas a administração encerra células.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cell_groups").update({ active: false }).eq("church_id", ctx.churchId).eq("id", parsed.data.cellId);
  if (error) return fromPostgrestError(error);
  revalidatePath("/celulas");
  return ok({ updated: true });
}
