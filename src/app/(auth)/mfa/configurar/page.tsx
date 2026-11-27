import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedAssurance } from "@/lib/auth/assurance";
import { requireUser } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MfaSettings } from "@/components/security/mfa-settings";

export const metadata: Metadata = { title: "Cadastrar verificação em duas etapas" };

/** Etapa obrigatória para administradores sem autenticador. Não usa resolveChurchContext (evita laço de redirecionamento). */
export default async function MfaEnrollPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const aal = await getVerifiedAssurance(supabase);
  if (aal.nextLevel === "aal2") redirect(aal.currentLevel === "aal2" ? "/dashboard" : "/mfa");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl">Proteja sua conta de administrador</h1>
        <p className="mt-1 text-sm text-texto-2">Para administrar a igreja, é preciso ativar a verificação em duas etapas. Leva um minuto.</p>
      </div>
      <MfaSettings factorId={null} promptEnrollment redirectTo="/dashboard" />
    </div>
  );
}
