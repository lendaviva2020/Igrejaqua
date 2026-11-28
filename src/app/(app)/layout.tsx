import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { countUnreadNotifications } from "@/modules/notifications/queries";

/** Área sem valor de busca: fora do índice (o proxy também envia X-Robots-Tag). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

const BASE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: "painel", bottom: true },
  { href: "/agenda", label: "Agenda", icon: "agenda", bottom: true },
  { href: "/ministerios", label: "Ministérios", icon: "ministerios", bottom: true },
  { href: "/repertorio", label: "Repertório", icon: "repertorio", bottom: true },
  { href: "/oracao", label: "Oração", icon: "oracao", bottom: true },
  { href: "/biblia", label: "Bíblia", icon: "biblia" },
  { href: "/comunicados", label: "Comunicados", icon: "comunicados" },
  { href: "/contribuir", label: "Contribuir", icon: "contribuir" },
  { href: "/disponibilidade", label: "Disponibilidade", icon: "disponibilidade" },
  { href: "/notificacoes", label: "Notificações", icon: "notificacoes" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveChurchContext();
  const unread = await countUnreadNotifications(ctx.churchId);
  const base = BASE_NAV.map((i) => (i.href === "/notificacoes" ? { ...i, badge: unread } : i));
  const extra: readonly NavItem[] = [
    { href: "/celulas", label: "Células", icon: "celulas" },
    ...(can(ctx, "member.invite") ? [{ href: "/membros", label: "Membros", icon: "membros" } as const] : []),
    { href: "/familias", label: "Famílias", icon: "familias" },
    ...(can(ctx, "visitor.manage") ? [{ href: "/visitantes", label: "Visitantes", icon: "visitantes" } as const] : []),
    ...(can(ctx, "finance.manage") ? [{ href: "/financeiro", label: "Financeiro", icon: "financeiro" } as const] : []),
  ];
  const nav: readonly NavItem[] = [...base, ...extra, { href: "/configuracoes", label: "Configurações", icon: "configuracoes" }];
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-fundo focus:p-3">Pular para o conteúdo</a>
      <AppShell churchName={ctx.churchName} role={ctx.role} items={nav} unread={unread}>{children}</AppShell>
    </>
  );
}
