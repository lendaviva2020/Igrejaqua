"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarOff, HandHeart, LayoutDashboard, Library, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface NavItem { readonly href: string; readonly label: string; readonly icon: "painel" | "agenda" | "ministerios" | "repertorio" | "disponibilidade" | "oracao" }
const ICONS: Record<NavItem["icon"], LucideIcon> = { painel: LayoutDashboard, ministerios: Users, repertorio: Library, agenda: CalendarDays, disponibilidade: CalendarOff, oracao: HandHeart };

export function NavLinks({ items, orientation }: { items: readonly NavItem[]; orientation: "side" | "bottom" }) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex gap-1", orientation === "side" ? "flex-col" : "justify-around")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-controle px-3 text-sm",
                orientation === "bottom" && "flex-col justify-center gap-0.5 px-4 text-xs",
                active ? "bg-superficie font-medium text-nanquim shadow-[inset_3px_0_0_var(--color-cobre)]" : "text-tinta-2 hover:text-tinta",
              )}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
