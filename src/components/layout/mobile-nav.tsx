"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NAV_ICONS } from "./nav-icons";
import { PendingMark, useIntentPrefetch } from "./nav-links";
import { isActivePath, type NavGroup, type NavItem } from "./navigation";
import { SignOutForm } from "./sign-out-form";

const SHEET_ID = "menu-completo";

function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem]", active ? "font-semibold text-ambar-claro" : "text-texto-2")}>
      <Icon aria-hidden="true" size={22} strokeWidth={active ? 2 : 1.75} />
      <span>{item.label}</span>
      <PendingMark />
    </Link>
  );
}

function SheetTile({ item, active, onSamePage }: { item: NavItem; active: boolean; onSamePage: () => void }) {
  const Icon = NAV_ICONS[item.icon];
  const { prefetch, onIntent } = useIntentPrefetch(false);
  return (
    <Link
      href={item.href}
      prefetch={prefetch}
      onTouchStart={onIntent}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      {...(active ? { onClick: onSamePage } : {})}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-superficie border px-1.5 py-3 text-center text-[0.8rem] leading-tight transition-colors",
        active ? "border-ambar bg-superficie-2 font-semibold text-texto" : "border-linha bg-superficie text-texto hover:border-borda",
      )}
    >
      <Icon aria-hidden="true" size={24} strokeWidth={1.75} className="text-ambar" />
      <span className="hyphens-auto break-words" lang="pt-BR">{item.label}</span>
      <PendingMark className="absolute bottom-2" />
      {item.badge !== undefined ? <span className="tabular absolute right-2 top-2 rounded-full bg-ambar px-1.5 text-[0.7rem] font-bold text-sobre-ambar" aria-label={`${item.badge} não lidas`}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
    </Link>
  );
}

/**
 * Navegação do celular (< 768 px): quatro destinos fixos e o botão Menu, que abre uma folha com
 * TODOS os módulos que o papel da pessoa permite, agrupados por assunto.
 */
export function MobileNav({ groups, primary, churchName, roleLabel, hasUnread, signOut }: {
  groups: readonly NavGroup[];
  primary: readonly NavItem[];
  churchName: string;
  roleLabel: string;
  hasUnread: boolean;
  signOut: () => Promise<never>;
}) {
  const pathname = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const onPrimary = primary.some((i) => isActivePath(pathname, i.href));

  // A folha fica aberta mostrando o indicador de carregamento e fecha quando a nova página chega.
  useEffect(() => {
    sheet.current?.close();
  }, [pathname]);

  const open = (): void => sheet.current?.showModal();
  const close = (): void => sheet.current?.close();
  // Clique no fundo escurecido (fora do conteúdo da folha) fecha.
  const onBackdrop = (e: MouseEvent<HTMLDialogElement>): void => { if (e.target === e.currentTarget) close(); };

  return (
    <>
      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((item) => (
            <li key={item.href}><BarLink item={item} active={isActivePath(pathname, item.href)} /></li>
          ))}
          <li>
            <button
              type="button"
              onClick={open}
              aria-haspopup="dialog"
              aria-controls={SHEET_ID}
              className={cn("relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.7rem]", onPrimary ? "text-texto-2" : "font-semibold text-ambar-claro")}
            >
              <Menu aria-hidden="true" size={22} strokeWidth={onPrimary ? 1.75 : 2} />
              <span>Menu</span>
              <span aria-hidden="true" className="h-0.5" />
              {hasUnread ? <><span aria-hidden="true" className="absolute right-[calc(50%-1.1rem)] top-2 size-2.5 rounded-full border-2 border-superficie bg-ambar" /><span className="sr-only">, há notificações não lidas</span></> : null}
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={sheet}
        id={SHEET_ID}
        aria-labelledby={`${SHEET_ID}-titulo`}
        onClick={onBackdrop}
        className="folha-menu m-0 mt-auto max-h-[88dvh] w-full max-w-full overflow-hidden rounded-t-[1.75rem] border-t border-linha bg-fundo p-0 text-texto backdrop:bg-black/60 md:hidden"
      >
        <div className="flex max-h-[88dvh] flex-col">
          <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-linha" />
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-2">
            <div className="min-w-0">
              <h2 id={`${SHEET_ID}-titulo`} className="truncate text-xl">{churchName}</h2>
              <p className="text-sm text-texto-2">{roleLabel}</p>
            </div>
            <button type="button" onClick={close} aria-label="Fechar menu" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-linha text-texto-2 hover:text-texto">
              <X aria-hidden="true" size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={`folha-${group.id}`} className="mt-4 first:mt-1">
                <h3 id={`folha-${group.id}`} className="mb-2 font-sans text-sm font-semibold text-texto-2">{group.label}</h3>
                <ul className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4">
                  {group.items.map((item) => (
                    <li key={item.href}><SheetTile item={item} active={isActivePath(pathname, item.href)} onSamePage={close} /></li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="border-t border-linha px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
            <SignOutForm action={signOut}>
              <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-borda text-sm font-semibold text-texto hover:border-perigo hover:text-perigo">
                <LogOut aria-hidden="true" size={18} />Sair da conta
              </button>
            </SignOutForm>
          </div>
        </div>
      </dialog>
    </>
  );
}
