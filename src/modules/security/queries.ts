import "server-only";
import { shouldPromptEnrollment } from "@/lib/auth/mfa-policy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface MfaState { readonly factorId: string | null; readonly promptEnrollment: boolean; readonly verifiedAt: string | null }

export async function getMfaState(role: "admin" | "leader" | "member"): Promise<MfaState> {
  const supabase = await createSupabaseServerClient();
  const [{ data: factors }, { data: aal }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  const factor = factors?.totp[0] ?? null;
  return { factorId: factor?.id ?? null, verifiedAt: factor?.updated_at ?? null, promptEnrollment: shouldPromptEnrollment(role, aal?.nextLevel ?? null) };
}
