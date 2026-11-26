import { describe, expect, it } from "vitest";
import { parseMoneyToCents } from "@/modules/finance/money";
import { CreateEntrySchema } from "@/modules/finance/schemas";

describe("parseMoneyToCents", () => {
  it.each([["10", 1000], ["10,5", 1050], ["10,50", 1050], ["1.250,00", 125000], ["1250,00", 125000], ["1250.75", 125075], ["R$ 99,99", 9999], ["0,01", 1], ["1.000", 100000]])("aceita %s", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });
  it.each(["", "0", "0,00", "-5", "abc", "1,234", "1.2.3", "10,5,0", "1e3", "99999999999999999"])("rejeita %s", (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });
});

describe("CreateEntrySchema", () => {
  const base = { kind: "entrada", categoryId: "6f1c2a52-8d0a-4c11-9d58-0f5f1b7a2c11", occurredOn: "2026-11-01", amount: "150,00", description: "Oferta" };
  it("converte o valor em centavos", () => {
    expect(CreateEntrySchema.parse(base).amount).toBe(15000);
  });
  it("rejeita valor inválido, campo extra (ex.: quem deu) e categoria fora do padrão", () => {
    expect(CreateEntrySchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(CreateEntrySchema.safeParse({ ...base, memberId: "x" }).success).toBe(false);
    expect(CreateEntrySchema.safeParse({ ...base, categoryId: "x" }).success).toBe(false);
  });
});
