import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/modules/identity/actions";
import { NavLinks, type NavItem } from "./nav-links";

const ROLE_LABEL = { admin: "Administração", leader: "Liderança", member: "Membro" } as const;

export function AppShell({ churchName, role, items, children }: { churchName: string; role: keyof typeof ROLE_LABEL; items: readonly NavItem[]; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-linha bg-papel md:flex md:flex-col md:gap-6 md:p-4" aria-label="Navegação principal">
        <div>
          <p className="font-display text-xl">{churchName}</p>
          <p className="text-xs text-tinta-2">{ROLE_LABEL[role]}</p>
          <div className="filete-duplo mt-3" aria-hidden="true" />
        </div>
        <nav aria-label="Seções"><NavLinks items={items} orientation="side" /></nav>
        <form action={signOutAction} className="mt-auto">
          <button type="submit" className="flex min-h-11 items-center gap-2 text-sm text-tinta-2 hover:text-tinta">
            <LogOut aria-hidden="true" size={16} strokeWidth={1.5} />Sair
          </button>
        </form>
      </aside>
      <div className="pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-linha px-4 py-3 md:hidden">
          <p className="font-display text-lg">{churchName}</p>
          <form action={signOutAction}><button type="submit" className="min-h-11 px-2 text-sm text-nanquim underline">Sair</button></form>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">{children}</main>
      </div>
      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 border-t border-linha bg-papel md:hidden"><NavLinks items={items} orientation="bottom" /></nav>
    </div>
  );
}
