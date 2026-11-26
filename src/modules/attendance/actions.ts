"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeaderCheckInSchema, RemoveAttendanceSchema, SelfCheckInSchema } from "./schemas";

function mapError(error: { code?: string; message: string }): Result<never> {
  if (error.code === "23505") return fail("CONFLICT", "Presença já registrada.");
  if (error.code === "23514" && /janela/.test(error.message)) return fail("RULE_VIOLATION", "O check-in abre 1 hora antes do início e fecha no fim da sessão.");
  return fromPostgrestError(error);
}

export async function selfCheckInAction(input: unknown): Promise<Result<{ checkedIn: true }>> {
  const parsed = SelfCheckInSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Sessão inválida.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance_records").insert({ church_id: ctx.churchId, session_id: parsed.data.sessionId, membership_id: ctx.membershipId, method: "self" });
  if (error) return mapError(error);
  revalidatePath("/agenda", "layout");
  return ok({ checkedIn: true });
}

export async function leaderCheckInAction(input: unknown): Promise<Result<{ checkedIn: true }>> {
  const parsed = LeaderCheckInSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "attendance.record.others")) return fail("FORBIDDEN", "Você não registra presença de outras pessoas.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance_records").insert({ church_id: ctx.churchId, session_id: parsed.data.sessionId, membership_id: parsed.data.membershipId, method: "leader" });
  if (error) return mapError(error);
  revalidatePath("/agenda", "layout");
  return ok({ checkedIn: true });
}

export async function removeAttendanceAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = RemoveAttendanceSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Registro inválido.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "attendance.record.others")) return fail("FORBIDDEN", "Você não remove registros de presença.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("attendance_records").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.attendanceId).select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Registro não encontrado.");
  revalidatePath("/agenda", "layout");
  return ok({ removed: true });
}
