import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InviteSchema } from "@/modules/members/schemas";
import { generateInviteToken, hashInviteToken } from "@/modules/members/token";

describe("token de convite", () => {
  it("gera tokens únicos, url-safe e com 256 bits", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("hash é sha256 hex (igual ao accept_invitation)", () => {
    const t = "abc";
    expect(hashInviteToken(t)).toBe(createHash("sha256").update(t).digest("hex"));
    expect(hashInviteToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("InviteSchema", () => {
  it("normaliza e-mail e rejeita papel inválido ou campos extras", () => {
    expect(InviteSchema.parse({ email: "  Ana@Igreja.COM ", role: "leader" }).email).toBe("ana@igreja.com");
    expect(InviteSchema.safeParse({ email: "x", role: "member" }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: "a@b.co", role: "member", church_id: "x" }).success).toBe(false);
  });
});
