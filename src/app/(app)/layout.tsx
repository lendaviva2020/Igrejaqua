import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { resolveChurchContext } from "@/lib/auth/context";

const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: "painel" },
  { href: "/agenda", label: "Agenda", icon: "agenda" },
  { href: "/ministerios", label: "Ministérios", icon: "ministerios" },
  { href: "/repertorio", label: "Repertório", icon: "repertorio" },
  { href: "/oracao", label: "Oração", icon: "oracao" },
  { href: "/disponibilidade", label: "Disponibilidade", icon: "disponibilidade" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveChurchContext();
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-papel focus:p-3">Pular para o conteúdo</a>
      <AppShell churchName={ctx.churchName} role={ctx.role} items={NAV}>{children}</AppShell>
    </>
  );
}
