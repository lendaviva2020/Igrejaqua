import { describe, expect, it } from "vitest";
import { CreateDsrSchema, ResolveDsrSchema, UpdateChurchSchema, UpdateProfileSchema } from "@/modules/settings/schemas";

describe("configurações", () => {
  it("valida fuso horário real", () => {
    expect(UpdateChurchSchema.safeParse({ name: "Igreja", timezone: "America/Sao_Paulo" }).success).toBe(true);
    expect(UpdateChurchSchema.safeParse({ name: "Igreja", timezone: "Marte/Olimpo" }).success).toBe(false);
  });
  it("CNPJ aceita só caracteres de máscara; telefone rejeita letras", () => {
    expect(UpdateChurchSchema.safeParse({ name: "Igreja", timezone: "America/Sao_Paulo", documentNumber: "12.345.678/0001-90" }).success).toBe(true);
    expect(UpdateChurchSchema.safeParse({ name: "Igreja", timezone: "America/Sao_Paulo", documentNumber: "abc" }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ fullName: "Ana", phone: "(11) 99999-0000" }).success).toBe(true);
    expect(UpdateProfileSchema.safeParse({ fullName: "Ana", phone: "ligue-me" }).success).toBe(false);
  });
  it("rejeita campos extras (church_id/user_id nunca vêm do cliente) e status final inválido", () => {
    expect(CreateDsrSchema.safeParse({ kind: "access", userId: "x" }).success).toBe(false);
    expect(CreateDsrSchema.safeParse({ kind: "apagar-tudo" }).success).toBe(false);
    expect(ResolveDsrSchema.safeParse({ requestId: "11111111-1111-4111-8111-111111111111", status: "open" }).success).toBe(false);
    expect(ResolveDsrSchema.safeParse({ requestId: "11111111-1111-4111-8111-111111111111", status: "done" }).success).toBe(true);
  });
});
