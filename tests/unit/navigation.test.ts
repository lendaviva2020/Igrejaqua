import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNavigation, isActivePath } from "@/components/layout/navigation";
import type { AuthContext } from "@/lib/permissions/capabilities";

const base = { userId: "u", churchId: "c", membershipId: "m" } as const;
const admin: AuthContext = { ...base, role: "admin", ministryPermissions: {} };
const member: AuthContext = { ...base, role: "member", ministryPermissions: {} };
const leaderWithMembers: AuthContext = { ...base, role: "leader", ministryPermissions: { "11111111-1111-4111-8111-111111111111": ["manage_members"] } };

const hrefs = (ctx: AuthContext): string[] => buildNavigation(ctx, 0).groups.flatMap((g) => g.items.map((i) => i.href));

describe("navegação do app", () => {
  it("todo módulo de src/app/(app) aparece para a administração (nenhum fica sem menu)", () => {
    const appDir = join(process.cwd(), "src/app/(app)");
    const modules = readdirSync(appDir).filter((n) => statSync(join(appDir, n)).isDirectory()).map((n) => `/${n}`);
    expect(new Set(hrefs(admin))).toEqual(new Set(modules));
  });

  it("membro não vê módulos que a página negaria (sem link para 404)", () => {
    const visible = hrefs(member);
    for (const hidden of ["/familias", "/visitantes", "/membros", "/financeiro"]) expect(visible).not.toContain(hidden);
    for (const shown of ["/dashboard", "/agenda", "/repertorio", "/oracao", "/biblia", "/comunicados", "/contribuir", "/disponibilidade", "/notificacoes", "/celulas", "/ministerios", "/configuracoes"]) expect(visible).toContain(shown);
  });

  it("liderança com gestão de membros vê Famílias e Visitantes, mas não Financeiro nem Membros", () => {
    const visible = hrefs(leaderWithMembers);
    expect(visible).toEqual(expect.arrayContaining(["/familias", "/visitantes"]));
    expect(visible).not.toContain("/financeiro");
    expect(visible).not.toContain("/membros");
  });

  it("barra inferior tem 4 destinos fixos e o selo de não lidas vai para Notificações", () => {
    const nav = buildNavigation(member, 3);
    expect(nav.primary.map((i) => i.href)).toEqual(["/dashboard", "/agenda", "/repertorio", "/oracao"]);
    const notif = nav.groups.flatMap((g) => g.items).find((i) => i.href === "/notificacoes");
    expect(notif?.badge).toBe(3);
    expect(buildNavigation(member, 0).groups.flatMap((g) => g.items).find((i) => i.href === "/notificacoes")).not.toHaveProperty("badge");
  });

  it("item ativo cobre subcaminhos sem confundir prefixos parecidos", () => {
    expect(isActivePath("/agenda/123", "/agenda")).toBe(true);
    expect(isActivePath("/agenda", "/agenda")).toBe(true);
    expect(isActivePath("/agendas", "/agenda")).toBe(false);
  });
});
