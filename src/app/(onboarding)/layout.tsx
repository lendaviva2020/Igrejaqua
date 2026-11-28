import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandName, Logo } from "@/components/shared/logo";
import { requireUser } from "@/lib/auth/context";

/** Área sem valor de busca: fora do índice (o proxy também envia X-Robots-Tag). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Fora do layout (app): quem ainda não tem igreja precisa chegar aqui sem exigir contexto de igreja (evita loop de redirecionamento). */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10 md:px-8">
      <div className="mb-8 flex items-center gap-3"><Logo size={36} decorative /><p className="text-2xl"><BrandName /></p></div>
      {children}
    </main>
  );
}
