import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { signOutAction } from "@/modules/identity/actions";
import { Logo } from "@/components/shared/logo";
import { MobileNav } from "./mobile-nav";
import { SideNav } from "./nav-links";
import type { Navigation } from "./navigation";
import { SignOutForm } from "./sign-out-form";

export const ROLE_LABEL = { admin: "Administração", leader: "Liderança", member: "Membro" } as const;

/**
 * Estrutura do app autenticado.
 * - ≥ 768 px: barra lateral fixa com todos os módulos agrupados (rola sozinha se a tela for baixa).
 * - < 768 px: cabeçalho com igreja e notificações + barra inferior com o botão Menu (todos os módulos).
 */
export function AppShell({ churchName, role, navigation, unread, children }: { churchName: string; role: keyof typeof ROLE_LABEL; navigation: Navigation; unread: number; children: ReactNode }) {
  const primaryHrefs = navigation.primary.map((i) => i.href);
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr] lg:grid-cols-[16.5rem_1fr]">
      <aside className="hidden border-r border-linha bg-fundo md:sticky md:top-0 md:flex md:h-dvh md:flex-col" aria-label="Navegação principal">
        <Link href="/dashboard" className="flex items-center gap-3 px-5 pb-4 pt-5">
          <Logo size={30} decorative />
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-bold">{churchName}</span>
            <span className="block text-xs text-texto-2">{ROLE_LABEL[role]}</span>
          </span>
        </Link>
        <nav aria-label="Seções" className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
          <SideNav groups={navigation.groups} primaryHrefs={primaryHrefs} />
        </nav>
        <SignOutForm action={signOutAction} className="border-t border-linha p-2">
          <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-controle px-3 text-sm text-texto-2 hover:bg-superficie hover:text-texto">
            <LogOut aria-hidden="true" size={18} strokeWidth={1.75} />Sair
          </button>
        </SignOutForm>
      </aside>

      <div className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-linha/60 bg-fundo/90 px-4 py-2.5 backdrop-blur-md md:hidden">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <Logo size={26} decorative />
            <span className="min-w-0">
              <span className="block truncate font-display text-[0.95rem] font-bold leading-tight">{churchName}</span>
              <span className="block text-xs leading-tight text-texto-2">{ROLE_LABEL[role]}</span>
            </span>
          </Link>
          <Link href="/notificacoes" aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"} className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-texto-2 hover:text-texto">
            <Bell aria-hidden="true" size={22} strokeWidth={1.75} />
            {unread > 0 ? <span aria-hidden="true" className="tabular absolute right-0.5 top-0.5 min-w-5 rounded-full bg-ambar px-1 text-center text-[0.65rem] font-bold leading-5 text-sobre-ambar">{unread > 9 ? "9+" : unread}</span> : null}
          </Link>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>

      <MobileNav groups={navigation.groups} primary={navigation.primary} churchName={churchName} roleLabel={ROLE_LABEL[role]} hasUnread={unread > 0} signOut={signOutAction} />
    </div>
  );
}
