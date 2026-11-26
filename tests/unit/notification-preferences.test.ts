import { describe, expect, it } from "vitest";
import { CHANNEL_DEFAULT, NOTIFICATION_CATEGORIES, RemovePushSubscriptionSchema, SavePushSubscriptionSchema, SetPreferenceSchema } from "@/modules/notifications/preferences";

describe("preferências de notificação", () => {
  it("aceita apenas categorias emitidas pelo banco", () => {
    expect(NOTIFICATION_CATEGORIES).toEqual(["escala", "comunicado", "devocional"]);
    expect(SetPreferenceSchema.safeParse({ category: "comunicado", enabled: false }).success).toBe(true);
    expect(SetPreferenceSchema.safeParse({ category: "marketing", enabled: true }).success).toBe(false);
  });
  it("canal padrão é o sistema; e-mail e celular são aceitos; outros canais não", () => {
    expect(SetPreferenceSchema.parse({ category: "escala", enabled: true }).channel).toBe("in_app");
    expect(SetPreferenceSchema.safeParse({ category: "escala", enabled: true, channel: "email" }).success).toBe(true);
    expect(SetPreferenceSchema.safeParse({ category: "escala", enabled: true, channel: "push" }).success).toBe(true);
    expect(SetPreferenceSchema.safeParse({ category: "escala", enabled: true, channel: "sms" }).success).toBe(false);
  });
  it("e-mail só com opt-in explícito", () => {
    expect(CHANNEL_DEFAULT).toEqual({ in_app: true, email: false, push: true });
  });
  it("rejeita campos extras (igreja e usuário nunca vêm do cliente)", () => {
    expect(SetPreferenceSchema.safeParse({ category: "escala", enabled: true, userId: "x" }).success).toBe(false);
    expect(SetPreferenceSchema.safeParse({ category: "escala", enabled: true, churchId: "x" }).success).toBe(false);
  });
  it("inscrição de push exige https e chaves plausíveis", () => {
    const ok = { endpoint: "https://push.exemplo.test/abc123", p256dh: "p".repeat(40), auth: "a".repeat(16) };
    expect(SavePushSubscriptionSchema.safeParse(ok).success).toBe(true);
    expect(SavePushSubscriptionSchema.safeParse({ ...ok, endpoint: "http://push.exemplo.test/abc123" }).success).toBe(false);
    expect(SavePushSubscriptionSchema.safeParse({ ...ok, userId: "x" }).success).toBe(false);
    expect(RemovePushSubscriptionSchema.safeParse({ endpoint: ok.endpoint }).success).toBe(true);
  });
});
