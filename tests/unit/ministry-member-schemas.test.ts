import { describe, expect, it } from "vitest";
import { AddMinistryMemberSchema, SetPermissionSchema, parseInstruments } from "@/modules/ministries/member-schemas";

const id = "11111111-1111-4111-8111-111111111111";
describe("integrantes de ministério", () => {
  it("parseInstruments remove vazios e espaços", () => {
    expect(parseInstruments(" violão, teclado ,, ")).toEqual(["violão", "teclado"]);
  });
  it("normaliza instrumentos (minúsculas, sem duplicatas) e aplica defaults", () => {
    const r = AddMinistryMemberSchema.parse({ ministryId: id, membershipId: id, instruments: ["Violão", "violão", "Teclado"] });
    expect(r.instruments).toEqual(["violão", "teclado"]);
    expect(r.role).toBe("member");
  });
  it("rejeita campos extras (church_id nunca vem do cliente), papel e permissão inválidos", () => {
    expect(AddMinistryMemberSchema.safeParse({ ministryId: id, membershipId: id, churchId: id }).success).toBe(false);
    expect(AddMinistryMemberSchema.safeParse({ ministryId: id, membershipId: id, role: "admin" }).success).toBe(false);
    expect(SetPermissionSchema.safeParse({ ministryId: id, ministryMembershipId: id, permission: "root", granted: true }).success).toBe(false);
    expect(SetPermissionSchema.safeParse({ ministryId: id, ministryMembershipId: id, permission: "manage_schedule", granted: true }).success).toBe(true);
  });
  it("limita a 10 instrumentos", () => {
    const many = Array.from({ length: 11 }, (_, i) => `i${i}`);
    expect(AddMinistryMemberSchema.safeParse({ ministryId: id, membershipId: id, instruments: many }).success).toBe(false);
  });
});
