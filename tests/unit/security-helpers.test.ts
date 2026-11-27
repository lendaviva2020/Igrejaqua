import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { slugify, CreateMinistrySchema } from "@/modules/ministries/actions-helpers";
import { fromPostgrestError, zodFieldErrors } from "@/lib/result";
import { SignUpSchema } from "@/modules/identity/schemas";
import { CreateSongSchema } from "@/modules/repertoire/schemas";

describe("safeNextPath (anti open-redirect)", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/repertorio?tom=A", "/repertorio?tom=A"],
    ["//evil.com", "/dashboard"],
    ["https://evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/ok\nSet-Cookie: x=1", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
    [undefined, "/dashboard"],
  ])("%j → %s", (input, expected) => expect(safeNextPath(input as string | null | undefined)).toBe(expected));
});

describe("slugify", () => {
  it("remove acentos e símbolos", () => {
    expect(slugify("Louvor & Adoração")).toBe("louvor-adoracao");
    expect(slugify("  Mídia  ")).toBe("midia");
    expect(slugify("!!")).toBe("ministerio");
  });
  it("satisfaz o CHECK do banco (^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$)", () => {
    for (const n of ["Jovens", "Célula 12", "Ação Social e Missões", "A B"]) expect(slugify(n)).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,58})[a-z0-9]$/);
  });
  it("valida entrada estrita", () => {
    expect(CreateMinistrySchema.safeParse({ name: "X" }).success).toBe(false);
    expect(CreateMinistrySchema.safeParse({ name: "Louvor", extra: 1 }).success).toBe(false);
  });
});

describe("validações Zod", () => {
  it("senha forte e e-mail normalizado", () => {
    expect(SignUpSchema.safeParse({ fullName: "Ana", email: "ANA@x.com", password: "curta1" }).success).toBe(false);
    expect(SignUpSchema.safeParse({ fullName: "Ana", email: "ANA@x.com", password: "somenteletrasaqui" }).success).toBe(false);
    expect(SignUpSchema.safeParse({ fullName: "Ana", email: "ANA@x.com", password: "senhaforte123456" }).success).toBe(false);
    const ok = SignUpSchema.safeParse({ fullName: "Ana", email: "ANA@x.com", password: "Senha-Forte-123" });
    expect(ok.success && ok.data.email).toBe("ana@x.com");
  });
  it("música: tom válido, cifra limitada, campos extras rejeitados", () => {
    expect(CreateSongSchema.safeParse({ title: "A", originalKey: "H", chordpro: "" }).success).toBe(false);
    expect(CreateSongSchema.safeParse({ title: "A", originalKey: "G", chordpro: "x".repeat(65537) }).success).toBe(false);
    expect(CreateSongSchema.safeParse({ title: "A", originalKey: "G", chordpro: "", church_id: "x" }).success).toBe(false);
    expect(CreateSongSchema.safeParse({ title: "A", originalKey: "F#m", chordpro: "[F#m]a", bpm: "72" }).success).toBe(true);
  });
  it("church_id vindo do cliente é rejeitado (.strict)", () => {
    expect(CreateMinistrySchema.safeParse({ name: "Louvor", church_id: "outra" }).success).toBe(false);
  });
});

describe("erros seguros", () => {
  it("não vaza SQL/stack", () => {
    const r = fromPostgrestError({ code: "XX000", message: 'relation "x" does not exist at character 15' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).not.toMatch(/relation|character/);
  });
  it("mapeia códigos conhecidos", () => {
    const r = fromPostgrestError({ code: "42501", message: "boom" });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });
  it("agrupa erros de campo", () => {
    expect(zodFieldErrors([{ path: ["a", 0], message: "x" }, { path: ["a", 0], message: "y" }])).toEqual({ "a.0": ["x", "y"] });
  });
});
