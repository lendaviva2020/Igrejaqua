import { z } from "zod";

/** Categorias emitidas hoje pelas triggers do banco (private.notify). Entrega: apenas dentro do sistema. */
export const NOTIFICATION_CATEGORIES = ["escala", "comunicado", "devocional"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, { title: string; hint: string }> = {
  escala: { title: "Escalas", hint: "Quando você for escalado(a) para uma função." },
  comunicado: { title: "Comunicados", hint: "Avisos da igreja e dos seus ministérios." },
  devocional: { title: "Devocionais", hint: "Devocionais publicados para você." },
};

export const SetPreferenceSchema = z.object({ category: z.enum(NOTIFICATION_CATEGORIES), enabled: z.boolean() }).strict();
