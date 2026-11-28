"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { NAV_ICONS } from "./nav-icons";
import { isActivePath, type NavGroup, type NavItem } from "./navigation";

/**
 * Retorno ao clique: enquanto a rota carrega, o item mostra um traço âmbar pulsante.
 * Precisa ficar dentro do <Link> (useLinkStatus lê o estado do link ancestral).
 * Só aparece se a navegação passar de 100 ms: navegações rápidas não piscam.
 */
export function PendingMark({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={cn("h-0.5 w-4 shrink-0 rounded-full bg-ambar transition-opacity", pending ? "animate-pulse opacity-100 delay-100" : "opacity-0", className)} />;
}

/**
 * Prefetch por intenção: o link só pré-carrega quando a pessoa passa o mouse, foca ou toca nele.
 * Cada prefetch é uma requisição ao servidor com validação de sessão no Auth; pré-carregar todos os
 * itens visíveis gerava dezenas de requisições por página. `eager` mantém o prefetch automático.
 */
export function useIntentPrefetch(eager: boolean): { prefetch: null | false; onIntent: () => void } {
  const [intent, setIntent] = useState(eager);
  return { prefetch: intent ? null : false, onIntent: () => setIntent(true) };
}

export function SideNavLink({ item, active, eager }: { item: NavItem; active: boolean; eager: boolean }) {
  const Icon = NAV_ICONS[item.icon];
  const { prefetch, onIntent } = useIntentPrefetch(eager);
  return (
    <Link
      href={item.href}
      prefetch={prefetch}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      onTouchStart={onIntent}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-controle px-3 text-sm transition-colors",
        active ? "bg-superficie-2 font-semibold text-texto" : "text-texto-2 hover:bg-superficie hover:text-texto",
      )}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} className={active ? "text-ambar" : "text-texto-2 group-hover:text-ambar-claro"} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <PendingMark />
      {item.badge !== undefined ? <><span aria-hidden="true" className="tabular rounded-full bg-ambar px-2 text-xs font-bold text-sobre-ambar">{item.badge > 99 ? "99+" : item.badge}</span><span className="sr-only"> ({item.badge} não lidas)</span></> : null}
    </Link>
  );
}

/** Barra lateral (tablet e desktop): todos os módulos, agrupados por assunto. */
export function SideNav({ groups, primaryHrefs }: { groups: readonly NavGroup[]; primaryHrefs: readonly string[] }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`nav-${group.id}`}>
          <h2 id={`nav-${group.id}`} className="mb-1 px-3 font-sans text-xs font-semibold text-texto-2/80">{group.label}</h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}><SideNavLink item={item} active={isActivePath(pathname, item.href)} eager={primaryHrefs.includes(item.href)} /></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
