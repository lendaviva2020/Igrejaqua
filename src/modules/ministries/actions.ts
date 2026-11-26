"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateMinistrySchema, slugify } from "./actions-helpers";

export async function createMinistryAction(input: unknown): Promise<Result<{ ministryId: string }>> {
  const parsed = CreateMinistrySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "ministry.create")) return fail("FORBIDDEN", "Apenas administradores criam ministérios.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ministries")
    .insert({ church_id: ctx.churchId, name: parsed.data.name, slug: slugify(parsed.data.name), description: parsed.data.description ?? null })
    .select("id")
    .single();
  if (error) return error.code === "23505" ? fail("CONFLICT", "Já existe um ministério com este nome.", { name: ["Nome já em uso"] }) : fromPostgrestError(error);
  revalidatePath("/ministerios");
  return ok({ ministryId: z.string().uuid().parse((data as { id: unknown }).id) });
}
