"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarDays, CalendarOff, HandHeart, HeartHandshake, LayoutDashboard, BookOpen, Library, Megaphone, Settings, UserCog, UserPlus, Users, Landmark, House, CircleDot, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface NavItem { readonly href: string; readonly label: string; readonly bottom?: boolean; readonly badge?: number; readonly icon: "contribuir" | "comunicados" | "notificacoes" | "painel" | "agenda" | "ministerios" | "repertorio" | "biblia" | "celulas" | "familias" | "visitantes" | "financeiro" | "disponibilidade" | "oracao" | "membros" | "configuracoes" }
const ICONS: Record<NavItem["icon"], LucideIcon> = { painel: LayoutDashboard, ministerios: Users, repertorio: Library, biblia: BookOpen, celulas: CircleDot, familias: House, visitantes: UserPlus, financeiro: Landmark, agenda: CalendarDays, disponibilidade: CalendarOff, oracao: HandHeart, comunicados: Megaphone, contribuir: HeartHandshake, notificacoes: Bell, membros: UserCog, configuracoes: Settings };

/**
 * Retorno ao clique: enquanto a rota carrega, o item mostra um traço âmbar pulsante.
 * Precisa ficar dentro do <Link> (useLinkStatus lê o estado do link ancestral).
 */
function PendingMark() {
  const { pending } = useLinkStatus();
  // Só aparece se a navegação passar de 100 ms: navegações rápidas não piscam.
  return <span aria-hidden="true" className={cn("h-0.5 w-4 rounded-full bg-ambar transition-opacity", pending ? "animate-pulse opacity-100 delay-100" : "opacity-0")} />;
}

/**
 * Prefetch: os itens principais (`bottom`) usam o padrão do Next (ao entrar na tela). Os secundários só
 * pré-carregam com intenção (hover, foco ou toque) — cada prefetch é uma requisição ao servidor com
 * validação de sessão no Auth, e 16 itens visíveis geravam ~35 requisições por página aberta.
 */
function NavLink({ item, orientation, active }: { item: NavItem; orientation: "side" | "bottom"; active: boolean }) {
  const [intent, setIntent] = useState(item.bottom === true);
  const Icon = ICONS[item.icon];
  const showIntent = (): void => setIntent(true);
  return (
    <Link
      href={item.href}
      prefetch={intent ? null : false}
      onMouseEnter={showIntent}
      onFocus={showIntent}
      onTouchStart={showIntent}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-controle px-3 text-sm",
        orientation === "bottom" && "flex-col justify-center gap-0.5 px-2 text-[0.7rem]",
        active ? "bg-superficie font-medium text-ambar-claro shadow-[inset_3px_0_0_var(--color-ambar)]" : "text-texto-2 hover:text-texto",
      )}
    >
      <Icon aria-hidden="true" size={orientation === "bottom" ? 22 : 18} strokeWidth={1.75} />
      <span>{item.label}</span>
      <PendingMark />
      {item.badge !== undefined && item.badge > 0 ? <span className="tabular ml-auto rounded-full bg-ambar px-2 text-xs font-bold text-sobre-ambar" aria-label={`${item.badge} não lidas`}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
    </Link>
  );
}

export function NavLinks({ items, orientation }: { items: readonly NavItem[]; orientation: "side" | "bottom" }) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex gap-1", orientation === "side" ? "flex-col" : "justify-around")}>
      {(orientation === "bottom" ? items.filter((i) => i.bottom) : items).map((item) => (
        <li key={item.href}>
          <NavLink item={item} orientation={orientation} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />
        </li>
      ))}
    </ul>
  );
}
