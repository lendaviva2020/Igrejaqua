import { z } from "zod";

/** Categorias emitidas hoje pelas triggers do banco (private.notify). Entrega: sistema, e-mail e celular (fila no banco). */
export const NOTIFICATION_CATEGORIES = ["escala", "comunicado", "devocional", "contribuicao", "membros"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, { title: string; hint: string }> = {
  escala: { title: "Escalas", hint: "Quando você for escalado(a) para uma função." },
  comunicado: { title: "Comunicados", hint: "Avisos da igreja e dos seus ministérios." },
  devocional: { title: "Devocionais", hint: "Devocionais publicados para você." },
  contribuicao: { title: "Contribuições", hint: "Só para a administração: aviso quando um Pix é confirmado (sem identificar quem contribuiu)." },
  membros: { title: "Pedidos de entrada", hint: "Só para a administração: aviso quando alguém pede para entrar pelo link da igreja." },
};

export const NOTIFICATION_CHANNELS = ["in_app", "email", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export const NOTIFICATION_CHANNEL_LABEL: Record<NotificationChannel, string> = { in_app: "No sistema", email: "E-mail", push: "Celular" };
/** Sem registro: avisos no sistema e no celular (se houver inscrição) ligados; e-mail só com opt-in explícito. */
export const CHANNEL_DEFAULT: Record<NotificationChannel, boolean> = { in_app: true, email: false, push: true };
export type ChannelPreferences = Readonly<Record<NotificationChannel, Readonly<Record<NotificationCategory, boolean>>>>;

export const SetPreferenceSchema = z.object({ category: z.enum(NOTIFICATION_CATEGORIES), channel: z.enum(NOTIFICATION_CHANNELS).default("in_app"), enabled: z.boolean() }).strict();

const HttpsEndpoint = z.string().url().max(500).refine((v) => v.startsWith("https://"), "O endereço da inscrição deve usar https.");
export const SavePushSubscriptionSchema = z.object({ endpoint: HttpsEndpoint, p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }).strict();
export const RemovePushSubscriptionSchema = z.object({ endpoint: HttpsEndpoint }).strict();
