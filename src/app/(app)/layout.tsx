import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { countUnreadNotifications } from "@/modules/notifications/queries";

const BASE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: "painel", bottom: true },
  { href: "/agenda", label: "Agenda", icon: "agenda", bottom: true },
  { href: "/ministerios", label: "Ministérios", icon: "ministerios", bottom: true },
  { href: "/repertorio", label: "Repertório", icon: "repertorio", bottom: true },
  { href: "/oracao", label: "Oração", icon: "oracao", bottom: true },
  { href: "/comunicados", label: "Comunicados", icon: "comunicados" },
  { href: "/contribuir", label: "Contribuir", icon: "contribuir" },
  { href: "/disponibilidade", label: "Disponibilidade", icon: "disponibilidade" },
  { href: "/notificacoes", label: "Notificações", icon: "notificacoes" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveChurchContext();
  const unread = await countUnreadNotifications(ctx.churchId);
  const base = BASE_NAV.map((i) => (i.href === "/notificacoes" ? { ...i, badge: unread } : i));
  const nav: readonly NavItem[] = can(ctx, "member.invite") ? [...base, { href: "/membros", label: "Membros", icon: "membros" }] : base;
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-fundo focus:p-3">Pular para o conteúdo</a>
      <AppShell churchName={ctx.churchName} role={ctx.role} items={nav} unread={unread}>{children}</AppShell>
    </>
  );
}
