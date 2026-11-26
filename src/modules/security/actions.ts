"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/context";
import { fail, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RemoveFactorSchema, VerifyChallengeSchema, VerifyEnrollmentSchema } from "./schemas";

export interface TotpEnrollment { readonly factorId: string; readonly qrSvg: string; readonly secret: string }

const GENERIC_CODE_ERROR = "Código inválido ou expirado. Confira o aplicativo e tente de novo.";

/** Inicia o cadastro de um autenticador (TOTP). Fatores não verificados antigos são descartados antes. */
export async function startTotpEnrollmentAction(): Promise<Result<TotpEnrollment>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return fail("INTERNAL", "Não foi possível iniciar o cadastro.");
  for (const stale of factors.all.filter((f) => f.factor_type === "totp" && f.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `IGREJAQUA ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return fail("INTERNAL", "Não foi possível iniciar o cadastro.");
  return ok({ factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret });
}

async function challengeAndVerify(factorId: string, code: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) return false;
  const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  return !verified.error;
}

export async function confirmTotpEnrollmentAction(input: unknown): Promise<Result<{ enrolled: true }>> {
  const parsed = VerifyEnrollmentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Digite os 6 números do aplicativo.");
  await requireUser();
  if (!(await challengeAndVerify(parsed.data.factorId, parsed.data.code))) return fail("VALIDATION", GENERIC_CODE_ERROR);
  revalidatePath("/configuracoes");
  return ok({ enrolled: true });
}

/** Segundo passo do login: usa o primeiro fator TOTP verificado do usuário. */
export async function verifyMfaChallengeAction(input: unknown): Promise<Result<{ verified: true }>> {
  const parsed = VerifyChallengeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Digite os 6 números do aplicativo.");
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return fail("INTERNAL", "Não foi possível verificar agora. Tente de novo.");
  const factor = data.totp[0];
  if (factor === undefined) return fail("VALIDATION", "Nenhum autenticador cadastrado.");
  if (!(await challengeAndVerify(factor.id, parsed.data.code))) return fail("VALIDATION", GENERIC_CODE_ERROR);
  return ok({ verified: true });
}

/** Remover um fator verificado exige sessão aal2 (regra do Supabase Auth); a verificação acontece lá. */
export async function removeTotpFactorAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = RemoveFactorSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Autenticador inválido.");
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: parsed.data.factorId });
  if (error) return fail("FORBIDDEN", "Confirme o código do aplicativo antes de remover o autenticador.");
  revalidatePath("/configuracoes");
  return ok({ removed: true });
}
