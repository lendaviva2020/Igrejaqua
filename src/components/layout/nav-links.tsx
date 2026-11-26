"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, CalendarOff, HandHeart, HeartHandshake, LayoutDashboard, Library, Megaphone, Settings, UserCog, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface NavItem { readonly href: string; readonly label: string; readonly bottom?: boolean; readonly badge?: number; readonly icon: "contribuir" | "comunicados" | "notificacoes" | "painel" | "agenda" | "ministerios" | "repertorio" | "disponibilidade" | "oracao" | "membros" | "configuracoes" }
const ICONS: Record<NavItem["icon"], LucideIcon> = { painel: LayoutDashboard, ministerios: Users, repertorio: Library, agenda: CalendarDays, disponibilidade: CalendarOff, oracao: HandHeart, comunicados: Megaphone, contribuir: HeartHandshake, notificacoes: Bell, membros: UserCog, configuracoes: Settings };

export function NavLinks({ items, orientation }: { items: readonly NavItem[]; orientation: "side" | "bottom" }) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex gap-1", orientation === "side" ? "flex-col" : "justify-around")}>
      {(orientation === "bottom" ? items.filter((i) => i.bottom) : items).map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-controle px-3 text-sm",
                orientation === "bottom" && "flex-col justify-center gap-0.5 px-2 text-[0.7rem]",
                active ? "bg-superficie font-medium text-ambar-claro shadow-[inset_3px_0_0_var(--color-ambar)]" : "text-texto-2 hover:text-texto",
              )}
            >
              <Icon aria-hidden="true" size={orientation === "bottom" ? 22 : 18} strokeWidth={1.75} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 ? <span className="tabular ml-auto rounded-full bg-ambar px-2 text-xs font-bold text-sobre-ambar" aria-label={`${item.badge} não lidas`}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
