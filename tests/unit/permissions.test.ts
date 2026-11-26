import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITIES, CHURCH_ROLES, MINISTRY_PERMISSIONS, assertCan, can, ForbiddenError, type Action, type AuthContext } from "@/lib/permissions/capabilities";

const base = { userId: "u", churchId: "c", membershipId: "m" } as const;
const admin: AuthContext = { ...base, role: "admin", ministryPermissions: {} };
const member: AuthContext = { ...base, role: "member", ministryPermissions: {} };
const leader: AuthContext = { ...base, role: "leader", ministryPermissions: { min1: ["manage_schedule", "view_availability"], min2: ["manage_content"] } };

describe("can()", () => {
  it("admin pode tudo", () => {
    for (const a of Object.keys(CAPABILITIES) as Action[]) expect(can(admin, a, "min1")).toBe(true);
  });
  it("membro só vê agenda", () => {
    for (const a of Object.keys(CAPABILITIES) as Action[]) expect(can(member, a, "min1")).toBe(a === "agenda.view");
  });
  it("líder: permissão vale só no ministério em que foi concedida", () => {
    expect(can(leader, "schedule.edit", "min1")).toBe(true);
    expect(can(leader, "schedule.edit", "min2")).toBe(false);
    expect(can(leader, "schedule.edit")).toBe(false); // sem escopo, nega
    expect(can(leader, "schedule.publish", "min1")).toBe(false);
    expect(can(leader, "content.publish.ministry", "min2")).toBe(true);
    expect(can(leader, "availability.view", "min1")).toBe(true);
  });
  it("papel 'leader' sozinho não concede poder", () => {
    const bare: AuthContext = { ...base, role: "leader", ministryPermissions: {} };
    for (const a of Object.keys(CAPABILITIES) as Action[]) expect(can(bare, a, "min1")).toBe(a === "agenda.view");
  });
  it("ações de admin ficam negadas ao líder", () => {
    for (const a of ["church.settings.update", "member.invite", "ministry.create", "audit.view", "contribution.manage", "data.export"] as const) {
      expect(can(leader, a, "min1")).toBe(false);
    }
  });
  it("anyMinistry: qualquer ministério com a permissão basta", () => {
    expect(can(leader, "event.manage")).toBe(true);
    expect(can(leader, "repertoire.manage")).toBe(false);
  });
  it("assertCan lança ForbiddenError", () => {
    expect(() => assertCan(member, "ministry.create")).toThrow(ForbiddenError);
  });
});

describe("paridade TS ↔ SQL", () => {
  const dir = join(process.cwd(), "supabase", "migrations");
  const sql = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  const enumValues = (name: string): string[] => {
    const m = new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`, "s").exec(sql);
    if (!m) throw new Error(`enum ${name} não encontrado`);
    return [...(m[1] as string).matchAll(/'([^']+)'/g)].map((x) => x[1] as string);
  };
  it("ministry_permission", () => expect(enumValues("ministry_permission")).toEqual([...MINISTRY_PERMISSIONS]));
  it("membership_role", () => expect(enumValues("membership_role")).toEqual([...CHURCH_ROLES]));
});
