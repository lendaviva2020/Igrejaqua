import { z } from "zod";
import { resolveAppBaseUrl } from "@/lib/app-url";

export interface EmailConfig { readonly apiKey: string; readonly from: string }
export interface PushConfig { readonly publicKey: string; readonly privateKey: string; readonly subject: string }
export interface DeliveryConfig {
  readonly siteUrl: string | null;
  readonly email: EmailConfig | null;
  readonly push: PushConfig | null;
}

const emailSchema = z.object({ RESEND_API_KEY: z.string().min(10), EMAIL_FROM: z.string().min(5).max(200) });
const pushSchema = z.object({
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(40),
  VAPID_PRIVATE_KEY: z.string().min(20),
  VAPID_SUBJECT: z.string().refine((v) => /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(v), "use mailto: ou https://"),
});

/** Cada canal só existe se a configuração estiver completa; sem ela, nada é enviado e o sistema segue funcionando. */
export function parseDeliveryConfig(env: Readonly<Record<string, string | undefined>>): DeliveryConfig {
  const email = emailSchema.safeParse({ RESEND_API_KEY: env["RESEND_API_KEY"] || undefined, EMAIL_FROM: env["EMAIL_FROM"] || undefined });
  const push = pushSchema.safeParse({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || undefined,
    VAPID_PRIVATE_KEY: env["VAPID_PRIVATE_KEY"] || undefined,
    VAPID_SUBJECT: env["VAPID_SUBJECT"] || undefined,
  });
  return {
    // Mesma regra dos convites (nunca localhost em produção); sem base pública, e-mails saem sem link.
    siteUrl: resolveAppBaseUrl(env),
    email: email.success ? { apiKey: email.data.RESEND_API_KEY, from: email.data.EMAIL_FROM } : null,
    push: push.success ? { publicKey: push.data.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: push.data.VAPID_PRIVATE_KEY, subject: push.data.VAPID_SUBJECT } : null,
  };
}
