import { describe, expect, it } from "vitest";
import { CreateContentSchema } from "@/modules/content/schemas";
import { CreatePrayerSchema } from "@/modules/prayer/schemas";
import { safeNextPath } from "@/lib/security/safe-redirect";

describe("CreateContentSchema", () => {
  const base = { kind: "announcement", title: "Retiro", body: "Inscrições abertas", publish: true } as const;
  it("aceita comunicado válido", () => expect(CreateContentSchema.safeParse(base).success).toBe(true));
  it("exige título e conteúdo", () => {
    expect(CreateContentSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(CreateContentSchema.safeParse({ ...base, body: "" }).success).toBe(false);
  });
  it("rejeita churchId/status vindos do cliente (strict)", () => {
    expect(CreateContentSchema.safeParse({ ...base, churchId: "x" }).success).toBe(false);
    expect(CreateContentSchema.safeParse({ ...base, status: "published" }).success).toBe(false);
  });
  it("rejeita ministryId que não é uuid", () => expect(CreateContentSchema.safeParse({ ...base, ministryId: "abc" }).success).toBe(false));
});

describe("CreatePrayerSchema", () => {
  it("aceita pedido anônimo", () => expect(CreatePrayerSchema.safeParse({ body: "Pela minha família", anonymous: true }).success).toBe(true));
  it("limita 2000 caracteres", () => expect(CreatePrayerSchema.safeParse({ body: "a".repeat(2001), anonymous: false }).success).toBe(false));
  it("não aceita autor vindo do cliente", () => expect(CreatePrayerSchema.safeParse({ body: "abc", anonymous: true, authorId: "x" }).success).toBe(false));
});

describe("link de notificação", () => {
  it("neutraliza URL protocol-relative que o CHECK do banco permitiria", () => {
    expect(safeNextPath("//evil.example/x")).toBe("/dashboard");
    expect(safeNextPath("/agenda/abc")).toBe("/agenda/abc");
  });
});
