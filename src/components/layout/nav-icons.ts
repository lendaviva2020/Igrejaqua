import { Bell, BookOpen, CalendarDays, CalendarOff, CircleDot, HandHeart, HeartHandshake, House, Landmark, LayoutDashboard, Library, Megaphone, Settings, UserCog, UserPlus, Users, type LucideIcon } from "lucide-react";
import type { NavIcon } from "./navigation";

/** Ícone de cada módulo (usado no servidor — painel — e no cliente — menus). */
export const NAV_ICONS: Readonly<Record<NavIcon, LucideIcon>> = {
  painel: LayoutDashboard,
  notificacoes: Bell,
  agenda: CalendarDays,
  repertorio: Library,
  ministerios: Users,
  disponibilidade: CalendarOff,
  oracao: HandHeart,
  comunicados: Megaphone,
  celulas: CircleDot,
  familias: House,
  visitantes: UserPlus,
  membros: UserCog,
  biblia: BookOpen,
  contribuir: HeartHandshake,
  financeiro: Landmark,
  configuracoes: Settings,
};
