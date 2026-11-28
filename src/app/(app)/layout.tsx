import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { buildNavigation } from "@/components/layout/navigation";
import { resolveChurchContext } from "@/lib/auth/context";
import { countUnreadNotifications } from "@/modules/notifications/queries";

/** Área sem valor de busca: fora do índice (o proxy também envia X-Robots-Tag). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveChurchContext();
  const unread = await countUnreadNotifications(ctx.churchId);
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-fundo focus:p-3">Pular para o conteúdo</a>
      <AppShell churchName={ctx.churchName} role={ctx.role} navigation={buildNavigation(ctx, unread)} unread={unread}>{children}</AppShell>
    </>
  );
}
