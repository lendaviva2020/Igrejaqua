import { describe, expect, it } from "vitest";
import { LeaderCheckInSchema, SelfCheckInSchema, isCheckInOpen } from "@/modules/attendance/schemas";

const start = new Date("2027-04-04T12:00:00Z");
const end = new Date("2027-04-04T14:00:00Z");
describe("janela de check-in (R-26)", () => {
  it("abre 60 min antes e fecha no fim", () => {
    expect(isCheckInOpen(start, end, new Date("2027-04-04T10:59:59Z"))).toBe(false);
    expect(isCheckInOpen(start, end, new Date("2027-04-04T11:00:00Z"))).toBe(true);
    expect(isCheckInOpen(start, end, new Date("2027-04-04T14:00:00Z"))).toBe(true);
    expect(isCheckInOpen(start, end, new Date("2027-04-04T14:00:01Z"))).toBe(false);
  });
  it("schemas rejeitam campos extras (membro nunca vem do cliente no check-in próprio)", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(SelfCheckInSchema.safeParse({ sessionId: id, membershipId: id }).success).toBe(false);
    expect(LeaderCheckInSchema.safeParse({ sessionId: id, membershipId: id }).success).toBe(true);
    expect(LeaderCheckInSchema.safeParse({ sessionId: id }).success).toBe(false);
  });
});
