import { describe, expect, it } from "vitest";
import { NOTIFICATION_CATEGORIES, SetPreferenceSchema } from "@/modules/notifications/preferences";

describe("preferências de notificação", () => {
  it("aceita apenas categorias emitidas pelo banco", () => {
    expect(NOTIFICATION_CATEGORIES).toEqual(["escala", "comunicado", "devocional"]);
    expect(SetPreferenceSchema.safeParse({ category: "comunicado", enabled: false }).success).toBe(true);
    expect(SetPreferenceSchema.safeParse({ category: "marketing", enabled: true }).success).toBe(false);
  });
  it("rejeita campos extras (canal, igreja e usuário nunca vêm do cliente)", () => {
    expect(SetPreferenceSchema.safeParse({ category: "escala", enabled: true, channel: "email" }).success).toBe(false);
    expect(SetPreferenceSchema.safeParse({ category: "escala", enabled: true, userId: "x" }).success).toBe(false);
  });
});
