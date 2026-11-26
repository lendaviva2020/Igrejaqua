"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CHURCH_COOKIE } from "@/lib/auth/context";
import { fail, ok, zodFieldErrors, type Result } from "@/lib/result";
import { allow, clientFingerprint } from "@/lib/security/rate-limit";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetRequestSchema, SignInSchema, SignUpSchema } from "./schemas";

export async function signInAction(input: unknown): Promise<Result<{ redirectTo: string }>> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const fp = await clientFingerprint();
  if (!(await allow(`login:${fp}:${parsed.data.email}`, 5, 60))) return fail("RATE_LIMITED", "Muitas tentativas. Aguarde um minuto.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  // Mensagem única: não revela se o e-mail existe.
  if (error) return fail("UNAUTHENTICATED", "E-mail ou senha incorretos.");
  return ok({ redirectTo: safeNextPath(parsed.data.next) });
}

export async function signUpAction(input: unknown): Promise<Result<{ needsEmailConfirmation: true }>> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const fp = await clientFingerprint();
  if (!(await allow(`signup:${fp}`, 5, 3600))) return fail("RATE_LIMITED", "Muitas tentativas. Tente mais tarde.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/callback` },
  });
  if (error && error.status !== 422) return fail("INTERNAL", "Não foi possível criar a conta agora.");
  // Resposta idêntica exista ou não o e-mail (anti-enumeração).
  return ok({ needsEmailConfirmation: true });
}

export async function requestPasswordResetAction(input: unknown): Promise<Result<{ sent: true }>> {
  const parsed = ResetRequestSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "E-mail inválido.", zodFieldErrors(parsed.error.issues));
  const fp = await clientFingerprint();
  if (!(await allow(`reset:${fp}`, 3, 3600))) return fail("RATE_LIMITED", "Muitas tentativas. Tente mais tarde.");
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/callback?next=/configuracoes` });
  return ok({ sent: true });
}

export async function signOutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(CHURCH_COOKIE);
  redirect("/login");
}
