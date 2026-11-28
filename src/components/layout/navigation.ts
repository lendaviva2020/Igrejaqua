import { can, type AuthContext } from "@/lib/permissions/capabilities";

/**
 * Modelo único da navegação do app autenticado: barra lateral (desktop), barra inferior + folha
 * "Menu" (celular) e atalhos do painel são gerados daqui. Assim nenhum módulo some de um lugar só.
 * A visibilidade usa as MESMAS capacidades que as páginas checam (um link nunca leva a um 404 de
 * permissão). Esconder o link é conveniência: a autorização continua na página e na RLS.
 */

export type NavIcon =
  | "painel" | "notificacoes" | "agenda" | "repertorio" | "ministerios" | "disponibilidade"
  | "oracao" | "comunicados" | "celulas" | "familias" | "visitantes" | "membros"
  | "biblia" | "contribuir" | "financeiro" | "configuracoes";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: NavIcon;
  /** Frase curta do que a pessoa faz ali (usada nos atalhos do painel). */
  readonly description: string;
  readonly badge?: number;
}

export interface NavGroup {
  readonly id: "inicio" | "culto" | "comunidade" | "palavra" | "contribuicoes" | "conta";
  readonly label: string;
  readonly items: readonly NavItem[];
}

export interface Navigation {
  readonly groups: readonly NavGroup[];
  /** Itens fixos da barra inferior do celular (o quinto botão abre o Menu com todo o resto). */
  readonly primary: readonly NavItem[];
}

const PRIMARY_HREFS = ["/dashboard", "/agenda", "/repertorio", "/oracao"] as const;

/** Monta a navegação para o papel do usuário. `unread` vira o selo de Notificações. */
export function buildNavigation(ctx: AuthContext, unread: number): Navigation {
  const when = (allowed: boolean, item: NavItem): readonly NavItem[] => (allowed ? [item] : []);
  const groups: NavGroup[] = [
    {
      id: "inicio",
      label: "Início",
      items: [
        { href: "/dashboard", label: "Painel", icon: "painel", description: "Seu próximo compromisso e sua escala." },
        { href: "/notificacoes", label: "Notificações", icon: "notificacoes", description: "Avisos de escala, comunicados e mais.", ...(unread > 0 ? { badge: unread } : {}) },
      ],
    },
    {
      id: "culto",
      label: "Cultos e louvor",
      items: [
        { href: "/agenda", label: "Agenda", icon: "agenda", description: "Cultos, ensaios e eventos." },
        { href: "/repertorio", label: "Repertório", icon: "repertorio", description: "Músicas, cifras e tons." },
        { href: "/ministerios", label: "Ministérios", icon: "ministerios", description: "Equipes, funções e escalas." },
        { href: "/disponibilidade", label: "Disponibilidade", icon: "disponibilidade", description: "Dias em que você não pode servir." },
      ],
    },
    {
      id: "comunidade",
      label: "Comunidade",
      items: [
        { href: "/oracao", label: "Oração", icon: "oracao", description: "Pedidos de oração, inclusive anônimos." },
        { href: "/comunicados", label: "Comunicados", icon: "comunicados", description: "Avisos e devocionais da igreja." },
        { href: "/celulas", label: "Células", icon: "celulas", description: "Grupos e encontros nas casas." },
        ...when(can(ctx, "family.view"), { href: "/familias", label: "Famílias", icon: "familias", description: "Quem é da mesma casa." }),
        ...when(can(ctx, "visitor.manage"), { href: "/visitantes", label: "Visitantes", icon: "visitantes", description: "Quem visitou e o acompanhamento." }),
        ...when(can(ctx, "member.invite"), { href: "/membros", label: "Membros", icon: "membros", description: "Convites, entradas e papéis." }),
      ],
    },
    {
      id: "palavra",
      label: "Palavra",
      items: [{ href: "/biblia", label: "Bíblia", icon: "biblia", description: "Leitura por livro e capítulo." }],
    },
    {
      id: "contribuicoes",
      label: "Contribuições",
      items: [
        { href: "/contribuir", label: "Contribuir", icon: "contribuir", description: "Dízimos e ofertas por Pix." },
        ...when(can(ctx, "finance.manage"), { href: "/financeiro", label: "Financeiro", icon: "financeiro", description: "Livro-caixa e relatório mensal." }),
      ],
    },
    {
      id: "conta",
      label: "Conta",
      items: [{ href: "/configuracoes", label: "Configurações", icon: "configuracoes", description: "Seus dados, segurança e a igreja." }],
    },
  ];
  const all = groups.flatMap((g) => g.items);
  const primary = PRIMARY_HREFS.flatMap((href) => all.filter((i) => i.href === href));
  return { groups, primary };
}

/** Item ativo: a própria rota ou qualquer subcaminho dela (ex.: /agenda/123 ativa Agenda). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
