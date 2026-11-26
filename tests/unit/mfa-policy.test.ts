import { describe, expect, it } from "vitest";
import { needsMfaChallenge, shouldPromptEnrollment } from "@/lib/auth/mfa-policy";
import { RemoveFactorSchema, TotpCodeSchema, VerifyChallengeSchema, VerifyEnrollmentSchema } from "@/modules/security/schemas";

describe("política de MFA", () => {
  it("admin com fator e sessão aal1 precisa desafiar", () => {
    expect(needsMfaChallenge("admin", "aal1", "aal2")).toBe(true);
  });
  it("admin já em aal2 não é desafiado de novo", () => {
    expect(needsMfaChallenge("admin", "aal2", "aal2")).toBe(false);
  });
  it("admin sem fator cadastrado não é trancado para fora", () => {
    expect(needsMfaChallenge("admin", "aal1", "aal1")).toBe(false);
    expect(needsMfaChallenge("admin", null, null)).toBe(false);
  });
  it("demais papéis nunca são forçados", () => {
    expect(needsMfaChallenge("leader", "aal1", "aal2")).toBe(false);
    expect(needsMfaChallenge("member", "aal1", "aal2")).toBe(false);
  });
  it("só admin sem fator recebe o convite para cadastrar", () => {
    expect(shouldPromptEnrollment("admin", "aal1")).toBe(true);
    expect(shouldPromptEnrollment("admin", "aal2")).toBe(false);
    expect(shouldPromptEnrollment("member", "aal1")).toBe(false);
  });
});

describe("schemas de MFA", () => {
  it("código TOTP tem exatamente 6 dígitos", () => {
    expect(TotpCodeSchema.safeParse("123456").success).toBe(true);
    for (const bad of ["12345", "1234567", "12345a", "", " 12345"]) expect(TotpCodeSchema.safeParse(bad).success).toBe(false);
  });
  it("rejeita campos extras e ids que não são uuid", () => {
    expect(VerifyChallengeSchema.safeParse({ code: "123456", userId: "x" }).success).toBe(false);
    expect(VerifyEnrollmentSchema.safeParse({ factorId: "nao-uuid", code: "123456" }).success).toBe(false);
    expect(RemoveFactorSchema.safeParse({ factorId: "6f1c2a52-8d0a-4c11-9d58-0f5f1b7a2c11" }).success).toBe(true);
  });
});
