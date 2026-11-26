import { describe, expect, it } from "vitest";
import { siteConfig } from "@/lib/site";

describe("siteConfig", () => {
  it("sem variáveis: nada é exibido e Google fica desligado", () => {
    const c = siteConfig({});
    expect(c.socials).toEqual([]);
    expect(c.churchName).toBeNull();
    expect(c.contactEmail).toBeNull();
    expect(c.googleLogin).toBe(false);
  });
  it("aceita apenas URLs https e ignora valores vazios", () => {
    const c = siteConfig({ NEXT_PUBLIC_SOCIAL_INSTAGRAM: "https://instagram.com/igreja", NEXT_PUBLIC_SOCIAL_YOUTUBE: "", NEXT_PUBLIC_SOCIAL_FACEBOOK: "http://facebook.com/x" });
    expect(c.socials.map((s) => s.network)).toEqual(["instagram"]);
  });
  it("rejeita esquemas perigosos e valor inválido não derruba a página", () => {
    const c = siteConfig({ NEXT_PUBLIC_SOCIAL_INSTAGRAM: "javascript:alert(1)", NEXT_PUBLIC_CONTACT_EMAIL: "não-é-email" });
    expect(c.socials).toEqual([]);
    expect(c.contactEmail).toBeNull();
  });
  it("habilita Google somente com 'true'", () => {
    expect(siteConfig({ NEXT_PUBLIC_AUTH_GOOGLE: "true" }).googleLogin).toBe(true);
    expect(siteConfig({ NEXT_PUBLIC_AUTH_GOOGLE: "sim" }).googleLogin).toBe(false);
  });
});
