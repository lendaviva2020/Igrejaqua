"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateContentSchema, SetContentStatusSchema, isValidSchedule } from "./schemas";

export async function createContentAction(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = CreateContentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const { ministryId } = parsed.data;
  const allowed = ministryId === undefined ? can(ctx, "content.publish.church") : can(ctx, "content.publish.ministry", ministryId);
  if (!allowed) return fail("FORBIDDEN", "Você não pode publicar para este público.");
  const publishAt = parsed.data.publishAt === undefined ? null : new Date(parsed.data.publishAt);
  if (publishAt !== null && !isValidSchedule(publishAt, new Date())) return fail("VALIDATION", "Escolha uma data entre 1 minuto e 1 ano à frente.", { publishAt: ["Data fora do intervalo permitido"] });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements_and_devotionals")
    .insert({
      church_id: ctx.churchId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      body_md: parsed.data.body,
      scripture_ref: parsed.data.scriptureRef && parsed.data.scriptureRef.length > 0 ? parsed.data.scriptureRef : null,
      audience: ministryId === undefined ? "church" : "ministry",
      ministry_id: ministryId ?? null,
      status: parsed.data.publish ? "published" : publishAt !== null ? "scheduled" : "draft",
      publish_at: publishAt === null ? null : publishAt.toISOString(),
      author_membership_id: ctx.membershipId,
    })
    .select("id")
    .single();
  if (error) return fromPostgrestError(error);
  revalidatePath("/comunicados");
  revalidatePath("/notificacoes");
  return ok({ id: z.string().uuid().parse((data as { id: unknown }).id) });
}

export async function setContentStatusAction(input: unknown): Promise<Result<{ status: string }>> {
  const parsed = SetContentStatusSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements_and_devotionals")
    .update({ status: parsed.data.status })
    .eq("church_id", ctx.churchId)
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return fromPostgrestError(error);
  // RLS filtra em silêncio: 0 linhas = sem permissão ou inexistente.
  if ((data as unknown[]).length === 0) return fail("FORBIDDEN", "Você não pode alterar este conteúdo.");
  revalidatePath("/comunicados");
  revalidatePath("/notificacoes");
  return ok({ status: parsed.data.status });
}
