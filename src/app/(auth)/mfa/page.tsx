import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedAssurance } from "@/lib/auth/assurance";
import { requireUser } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./mfa-challenge-form";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function MfaPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const aal = await getVerifiedAssurance(supabase);
  if (aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") redirect("/dashboard");
  return <MfaChallengeForm />;
}
