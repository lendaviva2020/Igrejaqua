import { describe, expect, it } from "vitest";
import { can, type AuthContext } from "@/lib/permissions/capabilities";
import { RecordMeetingSchema, CreateCellSchema } from "@/modules/cells/schemas";
import { AddFamilyMemberSchema } from "@/modules/families/schemas";
import { AddFollowupSchema, CreateVisitorSchema } from "@/modules/visitors/schemas";

const uuid = "6f1c2a52-8d0a-4c11-9d58-0f5f1b7a2c11";
const ctx = (role: AuthContext["role"], perms: AuthContext["ministryPermissions"] = {}): AuthContext => ({ userId: "u", churchId: "c", membershipId: "m", role, ministryPermissions: perms });

describe("permissões da Onda 2", () => {
  it("papel leader sozinho não vê visitantes/famílias; manage_members em um ministério vê", () => {
    expect(can(ctx("leader"), "visitor.manage")).toBe(false);
    expect(can(ctx("leader"), "family.view")).toBe(false);
    expect(can(ctx("leader", { m1: ["manage_members"] }), "visitor.manage")).toBe(true);
    expect(can(ctx("leader", { m1: ["manage_members"] }), "family.view")).toBe(true);
  });
  it("financeiro, células e exclusão de visitante são só da administração", () => {
    for (const a of ["finance.manage", "cell.manage", "family.manage", "visitor.delete"] as const) {
      expect(can(ctx("admin"), a)).toBe(true);
      expect(can(ctx("leader", { m1: ["manage_members", "manage_ministry"] }), a)).toBe(false);
      expect(can(ctx("member"), a)).toBe(false);
    }
  });
});

describe("famílias", () => {
  it("exige membro OU nome, nunca os dois nem nenhum", () => {
    const base = { familyId: uuid, relation: "filho" as const };
    expect(AddFamilyMemberSchema.safeParse({ ...base, membershipId: uuid }).success).toBe(true);
    expect(AddFamilyMemberSchema.safeParse({ ...base, fullName: "Pedro", birthDate: "2020-05-01" }).success).toBe(true);
    expect(AddFamilyMemberSchema.safeParse(base).success).toBe(false);
    expect(AddFamilyMemberSchema.safeParse({ ...base, membershipId: uuid, fullName: "Pedro" }).success).toBe(false);
    expect(AddFamilyMemberSchema.safeParse({ ...base, fullName: "Pedro", birthDate: "01/05/2020" }).success).toBe(false);
    expect(AddFamilyMemberSchema.safeParse({ ...base, fullName: "Pedro", churchId: uuid }).success).toBe(false);
  });
});

describe("visitantes (LGPD)", () => {
  it("telefone ou e-mail só com autorização registrada", () => {
    expect(CreateVisitorSchema.safeParse({ fullName: "Ana", phone: "11999990000", contactConsent: false }).success).toBe(false);
    expect(CreateVisitorSchema.safeParse({ fullName: "Ana", email: "ana@exemplo.com", contactConsent: false }).success).toBe(false);
    expect(CreateVisitorSchema.safeParse({ fullName: "Ana", phone: "11999990000", contactConsent: true }).success).toBe(true);
    expect(CreateVisitorSchema.safeParse({ fullName: "Ana", contactConsent: false }).success).toBe(true);
    expect(CreateVisitorSchema.safeParse({ fullName: "Ana", email: "invalido", contactConsent: true }).success).toBe(false);
  });
  it("acompanhamento exige descrição", () => {
    expect(AddFollowupSchema.safeParse({ visitorId: uuid, kind: "ligacao", note: "" }).success).toBe(false);
    expect(AddFollowupSchema.safeParse({ visitorId: uuid, kind: "ligacao", note: "Conversamos" }).success).toBe(true);
  });
});

describe("células", () => {
  it("valida dia, horário e presença", () => {
    expect(CreateCellSchema.safeParse({ name: "Centro", leaderMembershipId: uuid, weekday: "3", meetingTime: "19:30" }).success).toBe(true);
    expect(CreateCellSchema.safeParse({ name: "Centro", leaderMembershipId: uuid, weekday: "9" }).success).toBe(false);
    expect(CreateCellSchema.safeParse({ name: "Centro", leaderMembershipId: uuid, meetingTime: "25:00" }).success).toBe(false);
    expect(RecordMeetingSchema.parse({ cellId: uuid, heldOn: "2026-11-20" }).attendees).toEqual([]);
    expect(RecordMeetingSchema.safeParse({ cellId: uuid, heldOn: "2026-11-20", attendees: ["x"] }).success).toBe(false);
  });
});
