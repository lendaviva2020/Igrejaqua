import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { resolveChurchContext } from "@/lib/auth/context";
import { countUnreadNotifications } from "@/modules/notifications/queries";

const BASE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: "painel", bottom: true },
  { href: "/agenda", label: "Agenda", icon: "agenda", bottom: true },
  { href: "/ministerios", label: "Ministérios", icon: "ministerios", bottom: true },
  { href: "/repertorio", label: "Repertório", icon: "repertorio", bottom: true },
  { href: "/oracao", label: "Oração", icon: "oracao", bottom: true },
  { href: "/comunicados", label: "Comunicados", icon: "comunicados" },
  { href: "/disponibilidade", label: "Disponibilidade", icon: "disponibilidade" },
  { href: "/notificacoes", label: "Notificações", icon: "notificacoes" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveChurchContext();
  const unread = await countUnreadNotifications(ctx.churchId);
  const nav = BASE_NAV.map((i) => (i.href === "/notificacoes" ? { ...i, badge: unread } : i));
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-fundo focus:p-3">Pular para o conteúdo</a>
      <AppShell churchName={ctx.churchName} role={ctx.role} items={nav} unread={unread}>{children}</AppShell>
    </>
  );
}
