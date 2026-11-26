import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./mfa-challenge-form";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function MfaPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.nextLevel !== "aal2" || data.currentLevel === "aal2") redirect("/dashboard");
  return <MfaChallengeForm />;
}
