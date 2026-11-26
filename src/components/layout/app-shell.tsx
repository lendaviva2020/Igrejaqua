import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/modules/identity/actions";
import { Logo } from "@/components/shared/logo";
import { NavLinks, type NavItem } from "./nav-links";

const ROLE_LABEL = { admin: "Administração", leader: "Liderança", member: "Membro" } as const;

export function AppShell({ churchName, role, items, children }: { churchName: string; role: keyof typeof ROLE_LABEL; items: readonly NavItem[]; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-linha bg-fundo md:flex md:flex-col md:gap-6 md:p-4" aria-label="Navegação principal">
        <div className="flex items-center gap-3">
          <Logo size={36} className="shrink-0 text-ambar" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{churchName}</p>
            <p className="text-xs text-texto-2">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <nav aria-label="Seções"><NavLinks items={items} orientation="side" /></nav>
        <form action={signOutAction} className="mt-auto">
          <button type="submit" className="flex min-h-11 items-center gap-2 rounded-controle px-3 text-sm text-texto-2 hover:text-texto">
            <LogOut aria-hidden="true" size={16} strokeWidth={1.75} />Sair
          </button>
        </form>
      </aside>
      <div className="pb-24 md:pb-0">
        <header className="flex items-center justify-between gap-3 px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Logo size={28} className="shrink-0 text-ambar" />
            <p className="truncate text-base font-semibold uppercase tracking-wide">{churchName}</p>
          </div>
          <form action={signOutAction}><button type="submit" className="min-h-11 px-2 text-sm text-ambar-claro">Sair</button></form>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 border-t border-linha bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden"><NavLinks items={items} orientation="bottom" /></nav>
    </div>
  );
}
