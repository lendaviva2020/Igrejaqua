import { describe, expect, it } from "vitest";
import { parseDateRange } from "@/modules/availability/date-range";
import { CreateEventSchema } from "@/modules/events/schemas";

describe("parseDateRange", () => {
  it("converte fim exclusivo canônico do Postgres em data inclusiva", () => {
    expect(parseDateRange("[2027-03-14,2027-03-16)")).toEqual({ from: "2027-03-14", to: "2027-03-15" });
  });
  it("mantém fim inclusivo", () => {
    expect(parseDateRange("[2027-03-14,2027-03-16]")).toEqual({ from: "2027-03-14", to: "2027-03-16" });
  });
  it("atravessa virada de mês e ano", () => {
    expect(parseDateRange("[2026-12-30,2027-01-01)")).toEqual({ from: "2026-12-30", to: "2026-12-31" });
  });
  it("rejeita formato inválido", () => {
    expect(() => parseDateRange("lixo")).toThrow();
  });
});

describe("CreateEventSchema", () => {
  const base = { title: "Culto", kind: "service", startsLocal: "2027-04-04T09:00", endsLocal: "2027-04-04T11:00" } as const;
  it("aceita evento válido", () => expect(CreateEventSchema.safeParse(base).success).toBe(true));
  it("rejeita fim antes do início", () => expect(CreateEventSchema.safeParse({ ...base, endsLocal: "2027-04-04T08:00" }).success).toBe(false));
  it("rejeita campos extras (strict)", () => expect(CreateEventSchema.safeParse({ ...base, churchId: "x" }).success).toBe(false));
});
