import { describe, expect, it } from "vitest";
import { zonedLocalToUtc } from "@/lib/datetime/zoned";
import { CreateContentSchema, isValidSchedule } from "@/modules/content/schemas";

describe("zonedLocalToUtc", () => {
  it("converte horário de Brasília (UTC-3, sem horário de verão)", () => {
    expect(zonedLocalToUtc("2027-04-04T09:30", "America/Sao_Paulo")?.toISOString()).toBe("2027-04-04T12:30:00.000Z");
  });
  it("respeita fusos diferentes e horário de verão", () => {
    expect(zonedLocalToUtc("2027-01-15T09:00", "America/Manaus")?.toISOString()).toBe("2027-01-15T13:00:00.000Z");
    expect(zonedLocalToUtc("2027-07-01T12:00", "Europe/Lisbon")?.toISOString()).toBe("2027-07-01T11:00:00.000Z");
    expect(zonedLocalToUtc("2027-01-01T12:00", "Europe/Lisbon")?.toISOString()).toBe("2027-01-01T12:00:00.000Z");
  });
  it("rejeita formato inválido, data inexistente e fuso desconhecido", () => {
    expect(zonedLocalToUtc("", "America/Sao_Paulo")).toBeNull();
    expect(zonedLocalToUtc("2027-02-31T10:00", "America/Sao_Paulo")).toBeNull();
    expect(zonedLocalToUtc("2027-04-04T09:30", "Marte/Olimpo")).toBeNull();
  });
});

describe("agendamento de conteúdo", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  it("exige 1 minuto à frente e no máximo 1 ano", () => {
    expect(isValidSchedule(new Date("2027-01-01T00:00:30Z"), now)).toBe(false);
    expect(isValidSchedule(new Date("2027-01-01T00:01:00Z"), now)).toBe(true);
    expect(isValidSchedule(new Date("2028-06-01T00:00:00Z"), now)).toBe(false);
  });
  it("não aceita publicar agora e agendar ao mesmo tempo", () => {
    const base = { kind: "announcement", title: "Aviso", body: "Texto", publish: true, publishAt: "2027-02-01T12:00:00.000Z" };
    expect(CreateContentSchema.safeParse(base).success).toBe(false);
    expect(CreateContentSchema.safeParse({ ...base, publish: false }).success).toBe(true);
    expect(CreateContentSchema.safeParse({ ...base, publish: false, publishAt: "amanhã" }).success).toBe(false);
  });
});
